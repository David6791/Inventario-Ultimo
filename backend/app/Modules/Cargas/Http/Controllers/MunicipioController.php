<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\MunicipioRequest;
use App\Modules\Cargas\Models\Municipio;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Http\JsonResponse;

class MunicipioController extends Controller
{
    public function index(): JsonResponse
    {
        $municipios = Municipio::query()
            ->withCount(['cooperativas', 'minas'])
            ->orderBy('departamento')
            ->orderBy('nombre')
            ->get();

        return response()->json(['data' => $municipios]);
    }

    public function store(MunicipioRequest $request): JsonResponse
    {
        $municipio = Transaccion::delUsuarioActual(fn () => Municipio::create($request->validated()));

        return response()->json(['data' => $municipio->refresh()], 201);
    }

    public function update(MunicipioRequest $request, Municipio $municipio): JsonResponse
    {
        Transaccion::delUsuarioActual(fn () => $municipio->update($request->validated()));

        return response()->json(['data' => $municipio->refresh()]);
    }

    /** Se elimina solo si nada lo usa; si algo lo usa, la base lo impide y responde 422. */
    public function destroy(Municipio $municipio): JsonResponse
    {
        Transaccion::delUsuarioActual(fn () => $municipio->delete());

        return response()->json(['mensaje' => 'Municipio eliminado.']);
    }
}
