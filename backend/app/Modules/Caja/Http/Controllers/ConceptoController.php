<?php

namespace App\Modules\Caja\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Caja\Http\Requests\ConceptoRequest;
use App\Modules\Caja\Models\Concepto;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Conceptos de caja. Se listan todos, también los que genera cargas (para que
 * se vean en los reportes), pero solo los manuales se crean y editan aquí.
 */
class ConceptoController extends Controller
{
    public function index(): JsonResponse
    {
        $usos = DB::table('caja.movimiento')
            ->selectRaw('concepto_id, count(*) as cantidad')
            ->groupBy('concepto_id')
            ->pluck('cantidad', 'concepto_id');

        $conceptos = Concepto::query()
            ->orderByRaw("origen <> 'MANUAL'")
            ->orderBy('tipo')
            ->orderBy('nombre')
            ->get()
            ->map(fn (Concepto $c) => [...$c->toArray(), 'movimientos' => (int) ($usos[$c->id] ?? 0)]);

        return response()->json(['data' => $conceptos]);
    }

    public function store(ConceptoRequest $request): JsonResponse
    {
        $concepto = Transaccion::delUsuarioActual(fn () => Concepto::create($request->datos())->refresh());

        return response()->json(['data' => $concepto], 201);
    }

    public function update(ConceptoRequest $request, Concepto $concepto): JsonResponse
    {
        Transaccion::delUsuarioActual(fn () => $concepto->update($request->validated()));

        return response()->json(['data' => $concepto->refresh()]);
    }
}
