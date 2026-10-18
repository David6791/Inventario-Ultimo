<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\BancoRequest;
use App\Modules\Comun\Models\Banco;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Bancos (esquema comun): los usa cargas y, desde el sprint 2, caja. */
class BancoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $bancos = Banco::query()
            ->when($request->boolean('solo_activos'), fn ($q) => $q->activos())
            ->orderBy('nombre')
            ->get();

        return response()->json(['data' => $bancos]);
    }

    public function store(BancoRequest $request): JsonResponse
    {
        $banco = Transaccion::delUsuarioActual(fn () => Banco::create($request->validated()));

        return response()->json(['data' => $banco->refresh()], 201);
    }

    public function update(BancoRequest $request, Banco $banco): JsonResponse
    {
        Transaccion::delUsuarioActual(fn () => $banco->update($request->validated()));

        return response()->json(['data' => $banco->refresh()]);
    }

    public function destroy(Banco $banco): JsonResponse
    {
        Transaccion::delUsuarioActual(fn () => $banco->update(['activo' => false]));

        return response()->json(['data' => $banco->refresh(), 'mensaje' => 'Banco desactivado.']);
    }
}
