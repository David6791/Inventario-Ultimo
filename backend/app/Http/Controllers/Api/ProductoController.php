<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductoRequest;
use App\Http\Resources\ProductoResource;
use App\Models\Existencia;
use App\Models\Producto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductoController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('productos.ver'), 403);

        $productos = Producto::query()
            ->with(['categoria:id,nombre', 'unidadMedida:id,codigo,permite_decimales'])
            ->buscar($request->input('buscar'))
            ->when($request->filled('categoria_id'),
                fn ($q) => $q->where('categoria_id', $request->integer('categoria_id')))
            ->when($request->filled('activo'),
                fn ($q) => $q->where('activo', $request->boolean('activo')))
            ->orderBy('nombre')
            ->paginate($request->integer('por_pagina', 20))
            ->withQueryString();

        return ProductoResource::collection($productos);
    }

    public function show(Request $request, Producto $producto): ProductoResource
    {
        abort_unless($request->user()->can('productos.ver'), 403);

        return new ProductoResource(
            $producto->load(['categoria:id,nombre', 'unidadMedida:id,codigo,permite_decimales'])
        );
    }

    public function store(ProductoRequest $request): JsonResponse
    {
        abort_unless($request->user()->can('productos.crear'), 403);

        $producto = Producto::create($request->validated());

        return response()->json(
            new ProductoResource($producto->load(['categoria:id,nombre', 'unidadMedida:id,codigo,permite_decimales'])),
            201
        );
    }

    public function update(ProductoRequest $request, Producto $producto): ProductoResource
    {
        abort_unless($request->user()->can('productos.editar'), 403);

        $producto->update($request->validated());

        return new ProductoResource(
            $producto->fresh()->load(['categoria:id,nombre', 'unidadMedida:id,codigo,permite_decimales'])
        );
    }

    /**
     * Da de baja o reactiva. Un producto nunca se borra: el kardex y los
     * documentos históricos lo referencian para siempre.
     *
     * El estado vive solo en `activo`. Antes esto además hacía un soft delete,
     * y el resultado era que los productos dados de baja desaparecían de toda
     * consulta: el filtro "solo dados de baja" no devolvía nada, porque el
     * filtro global de SoftDeletes ya los había descartado. Dos formas de estar
     * inactivo es una de más.
     */
    public function cambiarEstado(Request $request, Producto $producto): ProductoResource
    {
        abort_unless($request->user()->can('productos.eliminar'), 403);

        $producto->update(['activo' => $request->boolean('activo')]);

        return new ProductoResource(
            $producto->fresh()->load(['categoria:id,nombre', 'unidadMedida:id,codigo,permite_decimales'])
        );
    }

    /**
     * Búsqueda liviana para los selectores de ingresos y salidas: devuelve solo
     * lo que la fila del documento necesita mostrar.
     */
    public function buscar(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('productos.ver'), 403);

        $productos = Producto::query()
            ->activos()
            ->with('unidadMedida:id,codigo,permite_decimales')
            ->buscar($request->input('q'))
            ->orderBy('nombre')
            ->limit(20)
            ->get();

        /*
        | El saldo del almacén activo viaja con cada resultado.
        |
        | Es lo que permite que la pantalla de solicitud de material muestre
        | "hay 12" mientras el usuario escribe, en vez de dejarlo cargar 50 y
        | recibir el rechazo recién al guardar. Una sola consulta para todos los
        | resultados, no una por producto.
        */
        $almacenId = $request->has('almacen_id')
            ? $request->integer('almacen_id')
            : (int) ($request->header('X-Almacen-Id')
                ?: $request->user()->almacenPredeterminado()?->id);

        $saldos = $almacenId
            ? Existencia::disponibles($productos->pluck('id')->all(), $almacenId)
            : [];

        return response()->json([
            'data' => $productos->map(fn (Producto $p) => [
                'id'                   => $p->id,
                'codigo'               => $p->codigo,
                'nombre'               => $p->nombre,
                'unidad'               => $p->unidadMedida->codigo,
                'permite_decimales'    => (bool) $p->unidadMedida->permite_decimales,
                'controla_lote'        => (bool) $p->controla_lote,
                'controla_vencimiento' => (bool) $p->controla_vencimiento,
                'disponible'           => $saldos[$p->id] ?? 0.0,
            ]),
        ]);
    }
}
