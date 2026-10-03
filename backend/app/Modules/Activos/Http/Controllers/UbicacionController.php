<?php

namespace App\Modules\Activos\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Activos\Http\Requests\UbicacionRequest;
use App\Modules\Activos\Models\Ubicacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UbicacionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $ubicaciones = Ubicacion::query()
            ->with('padre:id,nombre')
            ->when($request->boolean('solo_activas'), fn ($q) => $q->activas())
            ->orderBy('codigo')
            ->get()
            ->map(fn ($u) => array_merge($u->toArray(), ['ruta' => $u->ruta]));

        return response()->json(['data' => $ubicaciones]);
    }

    /** Estructura de árbol para el p-tree del frontend. */
    public function arbol(): JsonResponse
    {
        $todas = Ubicacion::activas()->orderBy('nombre')->get();

        $construir = function ($padreId) use ($todas, &$construir) {
            return $todas->where('padre_id', $padreId)->values()->map(fn ($u) => [
                'key'      => (string) $u->id,
                'label'    => $u->nombre,
                'data'     => $u->codigo,
                'children' => $construir($u->id),
            ]);
        };

        return response()->json(['data' => $construir(null)]);
    }

    public function store(UbicacionRequest $request): JsonResponse
    {
        $ubicacion = Ubicacion::create($request->validated());

        return response()->json(['data' => $ubicacion], 201);
    }

    public function update(UbicacionRequest $request, Ubicacion $ubicacion): JsonResponse
    {
        $ubicacion->update($request->validated());

        return response()->json(['data' => $ubicacion->fresh()]);
    }

    public function destroy(Ubicacion $ubicacion): JsonResponse
    {
        if ($ubicacion->hijas()->activas()->exists()) {
            return response()->json(
                ['mensaje' => 'No se puede desactivar: tiene ubicaciones dependientes activas.'],
                422
            );
        }

        $ubicacion->update(['activo' => false]);

        return response()->json(['data' => $ubicacion->fresh(), 'mensaje' => 'Ubicación desactivada.']);
    }
}
