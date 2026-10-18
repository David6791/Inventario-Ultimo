<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\LineaProductoRequest;
use App\Modules\Cargas\Models\LineaProducto;
use App\Modules\Cargas\Services\LineaProductoService;
use Illuminate\Http\JsonResponse;

class LineaProductoController extends Controller
{
    public function __construct(private readonly LineaProductoService $lineas)
    {
    }

    public function index(): JsonResponse
    {
        $lineas = LineaProducto::query()
            ->with(['elementos.elemento:id,codigo,nombre,unidad_ley'])
            ->withCount('series')
            ->orderBy('codigo')
            ->get();

        return response()->json(['data' => $lineas]);
    }

    public function store(LineaProductoRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->lineas->guardar($request->validated())], 201);
    }

    public function update(LineaProductoRequest $request, LineaProducto $linea): JsonResponse
    {
        return response()->json(['data' => $this->lineas->guardar($request->validated(), $linea)]);
    }
}
