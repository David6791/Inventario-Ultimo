<?php

namespace App\Modules\Activos\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Activos\Http\Requests\SubclaseRequest;
use App\Modules\Activos\Models\Subclase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubclaseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $subclases = Subclase::query()
            ->with('clase:id,codigo,nombre')
            ->when($request->filled('clase_id'), fn ($q) => $q->where('clase_id', $request->integer('clase_id')))
            ->when($request->boolean('solo_activas'), fn ($q) => $q->activas())
            ->orderBy('clase_id')->orderBy('codigo')
            ->get();

        return response()->json(['data' => $subclases]);
    }

    public function store(SubclaseRequest $request): JsonResponse
    {
        $subclase = Subclase::create($request->validated());

        return response()->json(['data' => $subclase->load('clase')], 201);
    }

    public function update(SubclaseRequest $request, Subclase $subclase): JsonResponse
    {
        $subclase->update($request->validated());

        return response()->json(['data' => $subclase->fresh()->load('clase')]);
    }

    public function destroy(Subclase $subclase): JsonResponse
    {
        $subclase->update(['activo' => false]);

        return response()->json(['data' => $subclase->fresh(), 'mensaje' => 'Subclase desactivada.']);
    }
}
