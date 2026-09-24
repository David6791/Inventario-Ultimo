<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ExistenciaResource;
use App\Models\CapaExistencia;
use App\Models\Existencia;
use App\Models\Producto;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * Consulta de existencias: qué hay ahora en el almacén.
 *
 * Es solo lectura. Las existencias se mueven por ingresos, salidas,
 * transferencias y ajustes — nunca editando esta pantalla.
 */
class ExistenciaController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('stock.ver'), 403);

        $almacenId = (int) app('almacen_actual');

        $existencias = Existencia::query()
            ->where('almacen_id', $almacenId)
            ->with([
                'producto:id,codigo,nombre,categoria_id,unidad_medida_id,stock_minimo,stock_maximo,activo',
                'producto.categoria:id,nombre',
                'producto.unidadMedida:id,codigo',
            ])
            // Un producto dado de baja con saldo sigue apareciendo: el material
            // está en el estante aunque ya no se compre más.
            ->whereHas('producto')
            ->when($request->filled('buscar'), fn ($q) => $this->filtrarTexto($q, $request->string('buscar')))
            ->when($request->filled('categoria_id'), fn ($q) => $q->whereHas(
                'producto', fn ($p) => $p->where('categoria_id', $request->integer('categoria_id'))
            ))
            ->when($request->filled('estado'), fn ($q) => $this->filtrarEstado($q, $request->string('estado')))
            ->when($request->boolean('con_saldo'), fn ($q) => $q->where('cantidad', '>', 0))
            ->orderBy(
                Producto::select('nombre')->whereColumn('productos.id', 'existencias.producto_id')
            )
            ->paginate($request->integer('por_pagina', 25))
            ->withQueryString();

        return ExistenciaResource::collection($existencias);
    }

    /**
     * Totales del almacén: cuántos ítems y cuánto vale el inventario.
     * Va aparte del listado para que la paginación no afecte los números.
     */
    public function resumen(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('stock.ver'), 403);

        $almacenId = (int) app('almacen_actual');

        $totales = DB::table('existencias as e')
            ->join('productos as p', 'p.id', '=', 'e.producto_id')
            ->where('e.almacen_id', $almacenId)
            ->selectRaw('
                count(*) filter (where e.cantidad > 0) as con_saldo,
                count(*) filter (where e.cantidad <= 0) as agotados,
                count(*) filter (where p.stock_minimo > 0 and e.cantidad > 0 and e.cantidad <= p.stock_minimo) as bajo_minimo,
                coalesce(sum(e.cantidad * e.costo_promedio), 0) as valor
            ')
            ->first();

        return response()->json([
            'con_saldo'   => (int) $totales->con_saldo,
            'agotados'    => (int) $totales->agotados,
            'bajo_minimo' => (int) $totales->bajo_minimo,
            // El valor solo para quien puede ver costos.
            'valor' => $request->user()->can('stock.ver-costos')
                ? round((float) $totales->valor, 2)
                : null,
        ]);
    }

    /**
     * Detalle de un producto: su saldo y las capas de costo vivas.
     *
     * Las capas son lo que explica el costo de verdad. Ver que quedan 8 a
     * Bs 25 y 12 a Bs 30 dice más que un promedio de Bs 28, y anticipa a qué
     * precio va a salir lo próximo.
     */
    public function show(Request $request, int|string $id): JsonResponse
    {
        abort_unless($request->user()->can('stock.ver'), 403);

        $productoId = (int) $id;
        $almacenId = (int) app('almacen_actual');

        $existencia = Existencia::query()
            ->where('producto_id', $productoId)
            ->where('almacen_id', $almacenId)
            ->with([
                'producto:id,codigo,nombre,categoria_id,unidad_medida_id,stock_minimo,stock_maximo,controla_lote,controla_vencimiento',
                'producto.categoria:id,nombre',
                'producto.unidadMedida:id,codigo',
                'almacen:id,nombre',
            ])
            ->firstOrFail();

        $veCostos = $request->user()->can('stock.ver-costos');

        $capas = CapaExistencia::disponibles($productoId, $almacenId)
            ->get()
            ->map(fn ($c) => [
                'id'                => $c->id,
                'fecha'             => $c->fecha?->toIso8601String(),
                'cantidad_inicial'  => (float) $c->cantidad_inicial,
                'cantidad_restante' => (float) $c->cantidad_restante,
                'costo_unitario'    => $veCostos ? (float) $c->costo_unitario : null,
                'valor'             => $veCostos
                    ? round((float) $c->cantidad_restante * (float) $c->costo_unitario, 2)
                    : null,
                'lote'              => $c->lote,
                'fecha_vencimiento' => $c->fecha_vencimiento?->toDateString(),
            ]);

        return response()->json([
            'existencia' => new ExistenciaResource($existencia),
            'capas'      => $capas,
        ]);
    }

    private function filtrarTexto(Builder $query, $texto): Builder
    {
        return $query->whereHas('producto', function ($p) use ($texto) {
            $patron = '%'.mb_strtolower(trim($texto)).'%';

            $p->where(fn ($s) => $s
                ->whereRaw('lower(inmutable_unaccent(nombre)) like inmutable_unaccent(?)', [$patron])
                ->orWhereRaw('lower(codigo) like ?', [$patron]));
        });
    }

    /**
     * Los estados se calculan comparando contra el mínimo del producto, así que
     * el filtro tiene que cruzar las dos tablas.
     */
    private function filtrarEstado(Builder $query, $estado): Builder
    {
        return match ((string) $estado) {
            'agotado' => $query->where('cantidad', '<=', 0),

            'bajo' => $query->where('cantidad', '>', 0)
                ->whereHas('producto', fn ($p) => $p->where('stock_minimo', '>', 0))
                ->whereRaw('existencias.cantidad <= (select stock_minimo from productos where productos.id = existencias.producto_id)'),

            'exceso' => $query->whereRaw('
                existencias.cantidad > coalesce(
                    (select stock_maximo from productos where productos.id = existencias.producto_id),
                    existencias.cantidad
                )'),

            'normal' => $query->where('cantidad', '>', 0)
                ->whereRaw('existencias.cantidad > coalesce(
                    (select stock_minimo from productos where productos.id = existencias.producto_id), 0
                )'),

            default => $query,
        };
    }
}
