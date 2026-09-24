<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\KardexResource;
use App\Models\Existencia;
use App\Models\MovimientoKardex;
use App\Models\Producto;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * Kardex: el histórico de movimientos de un producto en un almacén.
 *
 * Es solo lectura y no se puede alterar. Una anulación no borra el movimiento
 * original: escribe uno inverso, así la historia queda completa.
 */
class KardexController extends Controller
{
    public function index(Request $request, int|string $id): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('kardex.ver'), 403);

        $productoId = (int) $id;
        $almacenId = (int) app('almacen_actual');

        $movimientos = MovimientoKardex::query()
            ->withoutGlobalScopes()
            ->where('producto_id', $productoId)
            ->where('almacen_id', $almacenId)
            ->with('registradoPor:id,name')
            ->when($request->filled('desde'), fn ($q) => $q->whereDate('fecha', '>=', $request->date('desde')))
            ->when($request->filled('hasta'), fn ($q) => $q->whereDate('fecha', '<=', $request->date('hasta')))
            ->when($request->filled('tipo'), fn ($q) => $q->where('tipo', $request->string('tipo')))
            // Del más reciente al más antiguo: lo que se consulta primero es lo
            // último que pasó. El PDF va al revés.
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->paginate($request->integer('por_pagina', 30))
            ->withQueryString();

        return KardexResource::collection($movimientos);
    }

    /**
     * Encabezado del kardex: producto, almacén y saldo actual.
     * Se pide aparte del listado para no repetirlo en cada página.
     */
    public function encabezado(Request $request, int|string $id): JsonResponse
    {
        abort_unless($request->user()->can('kardex.ver'), 403);

        $productoId = (int) $id;
        $almacenId = (int) app('almacen_actual');

        $producto = Producto::with(['categoria:id,nombre', 'unidadMedida:id,codigo'])
            ->findOrFail($productoId);

        $existencia = Existencia::where('producto_id', $productoId)
            ->where('almacen_id', $almacenId)
            ->first();

        return response()->json([
            'producto_id' => $producto->id,
            'codigo'      => $producto->codigo,
            'producto'    => $producto->nombre,
            'categoria'   => $producto->categoria?->nombre,
            'unidad'      => $producto->unidadMedida?->codigo,
            'saldo'       => (float) ($existencia?->cantidad ?? 0),
            'costo_promedio' => $request->user()->can('stock.ver-costos')
                ? (float) ($existencia?->costo_promedio ?? 0)
                : null,
        ]);
    }

    /** El kardex impreso, en orden cronológico como corresponde a un libro. */
    public function pdf(Request $request, int|string $id): Response
    {
        abort_unless($request->user()->can('kardex.exportar'), 403);

        $productoId = (int) $id;
        $almacenId = (int) app('almacen_actual');

        $producto = Producto::with('unidadMedida:id,codigo')->findOrFail($productoId);
        $almacen  = \App\Models\Almacen::findOrFail($almacenId);

        $movimientos = MovimientoKardex::query()
            ->withoutGlobalScopes()
            ->where('producto_id', $productoId)
            ->where('almacen_id', $almacenId)
            ->when($request->filled('desde'), fn ($q) => $q->whereDate('fecha', '>=', $request->date('desde')))
            ->when($request->filled('hasta'), fn ($q) => $q->whereDate('fecha', '<=', $request->date('hasta')))
            ->orderBy('fecha')
            ->orderBy('id')
            ->get();

        $pdf = Pdf::loadView('pdf.kardex', [
            'producto'    => $producto,
            'almacen'     => $almacen,
            'movimientos' => $movimientos,
            'desde'       => $request->input('desde'),
            'hasta'       => $request->input('hasta'),
            'veCostos'    => $request->user()->can('stock.ver-costos'),
            'institucion' => config('app.name'),
        ])->setPaper('letter', 'landscape');

        return $pdf->stream("kardex-{$producto->codigo}.pdf");
    }
}
