<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\LaboratorioRequest;
use App\Modules\Cargas\Models\Laboratorio;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LaboratorioController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $laboratorios = Laboratorio::query()
            ->when($request->boolean('solo_activos'), fn ($q) => $q->where('activo', true))
            ->orderByDesc('propio')
            ->orderBy('nombre')
            ->get();

        return response()->json(['data' => $laboratorios]);
    }

    public function store(LaboratorioRequest $request): JsonResponse
    {
        $laboratorio = Transaccion::delUsuarioActual(fn () => Laboratorio::create($request->validated()));

        return response()->json(['data' => $laboratorio->refresh()], 201);
    }

    public function update(LaboratorioRequest $request, Laboratorio $laboratorio): JsonResponse
    {
        Transaccion::delUsuarioActual(fn () => $laboratorio->update($request->validated()));

        return response()->json(['data' => $laboratorio->refresh()]);
    }

    public function destroy(Laboratorio $laboratorio): JsonResponse
    {
        Transaccion::delUsuarioActual(fn () => $laboratorio->update(['activo' => false]));

        return response()->json(['data' => $laboratorio->refresh(), 'mensaje' => 'Laboratorio desactivado.']);
    }
}
