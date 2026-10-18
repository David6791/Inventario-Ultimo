<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\BocaminaRequest;
use App\Modules\Cargas\Http\Requests\MinaRequest;
use App\Modules\Cargas\Models\Bocamina;
use App\Modules\Cargas\Models\Mina;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Minas y sus bocaminas. Las minas propias de la empresa no tienen cooperativa. */
class MinaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $minas = Mina::query()
            ->with(['cooperativa:id,nombre', 'municipio:id,nombre'])
            ->withCount(['bocaminas as bocaminas_activas' => fn ($q) => $q->where('activa', true)])
            ->when($request->filled('cooperativa_id'), fn ($q) => $q->where('cooperativa_id', $request->integer('cooperativa_id')))
            ->when($request->has('propia'), fn ($q) => $q->where('propia', $request->boolean('propia')))
            ->when($request->boolean('solo_activas'), fn ($q) => $q->activas())
            ->orderByDesc('propia')
            ->orderBy('nombre')
            ->get();

        return response()->json(['data' => $minas]);
    }

    public function store(MinaRequest $request): JsonResponse
    {
        $mina = Transaccion::delUsuarioActual(fn () => Mina::create($request->validated()));

        return response()->json(['data' => $mina->refresh()], 201);
    }

    public function update(MinaRequest $request, Mina $mina): JsonResponse
    {
        Transaccion::delUsuarioActual(fn () => $mina->update($request->validated()));

        return response()->json(['data' => $mina->refresh()]);
    }

    public function destroy(Mina $mina): JsonResponse
    {
        $activas = $mina->bocaminas()->where('activa', true)->count();
        if ($activas > 0) {
            return response()->json([
                'message' => "No se desactivó: la mina tiene {$activas} bocamina(s) activa(s). Desactívelas primero.",
            ], 422);
        }

        Transaccion::delUsuarioActual(fn () => $mina->update(['activa' => false]));

        return response()->json(['data' => $mina->refresh(), 'mensaje' => 'Mina desactivada.']);
    }

    // ------------------------------------------------------------- Bocaminas

    public function bocaminas(Mina $mina): JsonResponse
    {
        return response()->json(['data' => $mina->bocaminas()->orderBy('codigo')->get()]);
    }

    public function crearBocamina(BocaminaRequest $request, Mina $mina): JsonResponse
    {
        $bocamina = Transaccion::delUsuarioActual(fn () => $mina->bocaminas()->create($request->validated()));

        return response()->json(['data' => $bocamina->refresh()], 201);
    }

    /** La bocamina no cambia de mina: los lotes la validan junto con su mina. */
    public function actualizarBocamina(BocaminaRequest $request, Bocamina $bocamina): JsonResponse
    {
        Transaccion::delUsuarioActual(fn () => $bocamina->update($request->validated()));

        return response()->json(['data' => $bocamina->refresh()]);
    }
}
