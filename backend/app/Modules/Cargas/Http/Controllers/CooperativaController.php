<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\CooperativaRequest;
use App\Modules\Cargas\Models\Cooperativa;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CooperativaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $cooperativas = Cooperativa::query()
            ->with('municipio:id,nombre')
            ->withCount([
                'productores as productores_activos' => fn ($q) => $q->where('activo', true),
                'minas as minas_activas'             => fn ($q) => $q->where('activa', true),
            ])
            ->when($request->boolean('solo_activas'), fn ($q) => $q->activas())
            ->orderBy('nombre')
            ->get();

        return response()->json(['data' => $cooperativas]);
    }

    public function store(CooperativaRequest $request): JsonResponse
    {
        $cooperativa = Transaccion::delUsuarioActual(fn () => Cooperativa::create($request->validated()));

        return response()->json(['data' => $cooperativa->refresh()], 201);
    }

    public function update(CooperativaRequest $request, Cooperativa $cooperativa): JsonResponse
    {
        Transaccion::delUsuarioActual(fn () => $cooperativa->update($request->validated()));

        return response()->json(['data' => $cooperativa->refresh()]);
    }

    /** Se desactiva solo si ya no tiene productores ni minas activos. */
    public function destroy(Cooperativa $cooperativa): JsonResponse
    {
        $productores = $cooperativa->productores()->where('activo', true)->count();
        $minas       = $cooperativa->minas()->where('activa', true)->count();

        if ($productores > 0 || $minas > 0) {
            return response()->json([
                'message' => "No se desactivó: la cooperativa tiene {$productores} productor(es) y {$minas} mina(s) activos. "
                    . 'Desactívelos o cámbielos de cooperativa primero.',
            ], 422);
        }

        Transaccion::delUsuarioActual(fn () => $cooperativa->update(['activa' => false]));

        return response()->json(['data' => $cooperativa->refresh(), 'mensaje' => 'Cooperativa desactivada.']);
    }
}
