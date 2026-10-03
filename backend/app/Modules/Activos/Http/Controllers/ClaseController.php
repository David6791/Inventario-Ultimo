<?php

namespace App\Modules\Activos\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Activos\Http\Requests\ClaseRequest;
use App\Modules\Activos\Models\Clase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClaseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $clases = Clase::query()
            ->when($request->boolean('solo_activas'), fn ($q) => $q->activas())
            ->when($request->filled('buscar'), function ($q) use ($request) {
                $buscar = '%' . strtolower($request->string('buscar')) . '%';
                $q->where(fn ($s) => $s->whereRaw('lower(nombre) like ?', [$buscar])
                                       ->orWhere('codigo', 'like', $buscar));
            })
            ->withCount('subclases')
            ->orderBy('codigo')
            ->get();

        return response()->json(['data' => $clases]);
    }

    public function show(Clase $clase): JsonResponse
    {
        return response()->json(['data' => $clase->load('subclases')]);
    }

    public function store(ClaseRequest $request): JsonResponse
    {
        $clase = Clase::create($request->validated());

        return response()->json(['data' => $clase], 201);
    }

    public function update(ClaseRequest $request, Clase $clase): JsonResponse
    {
        $clase->update($request->validated());

        return response()->json(['data' => $clase->fresh()]);
    }

    /**
     * No elimina: desactiva. Los catálogos son referenciados por activos
     * históricos y por períodos ya cerrados.
     */
    public function destroy(Clase $clase): JsonResponse
    {
        $enUso = \DB::table('activos.activo')->where('clase_id', $clase->id)->exists();

        $clase->update(['activo' => false]);

        return response()->json([
            'data'    => $clase->fresh(),
            'mensaje' => $enUso
                ? 'Clase desactivada. Tiene activos asociados, por eso no se elimina.'
                : 'Clase desactivada.',
        ]);
    }
}
