<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\ProductorRequest;
use App\Modules\Cargas\Models\Productor;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Productores: el catálogo crece con cada recepción, así que la lista se
 * pagina y se busca en el servidor (nombre, CI, NIT o NIM).
 */
class ProductorController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'buscar'         => ['nullable', 'string', 'max:100'],
            'tipo'           => ['nullable', 'in:' . implode(',', Productor::TIPOS)],
            'cooperativa_id' => ['nullable', 'integer'],
            'por_pagina'     => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $pagina = Productor::query()
            ->with('cooperativa:id,nombre')
            ->buscar($request->input('buscar'))
            ->when($request->filled('tipo'), fn ($q) => $q->where('tipo', $request->input('tipo')))
            ->when($request->filled('cooperativa_id'), fn ($q) => $q->where('cooperativa_id', $request->integer('cooperativa_id')))
            ->when($request->boolean('solo_activos'), fn ($q) => $q->activos())
            ->orderBy('nombre')
            ->paginate($request->integer('por_pagina', 25));

        return response()->json($pagina);
    }

    public function show(Productor $productor): JsonResponse
    {
        return response()->json(['data' => $productor->load('cooperativa:id,nombre')]);
    }

    public function store(ProductorRequest $request): JsonResponse
    {
        $productor = Transaccion::delUsuarioActual(fn () => Productor::create($request->validated()));

        return response()->json(['data' => $productor->refresh()->load('cooperativa:id,nombre')], 201);
    }

    public function update(ProductorRequest $request, Productor $productor): JsonResponse
    {
        Transaccion::delUsuarioActual(fn () => $productor->update($request->validated()));

        return response()->json(['data' => $productor->refresh()->load('cooperativa:id,nombre')]);
    }

    public function destroy(Productor $productor): JsonResponse
    {
        Transaccion::delUsuarioActual(fn () => $productor->update(['activo' => false]));

        return response()->json(['data' => $productor->refresh(), 'mensaje' => 'Productor desactivado.']);
    }
}
