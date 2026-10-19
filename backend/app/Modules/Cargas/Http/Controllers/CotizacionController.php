<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\CotizacionRequest;
use App\Modules\Cargas\Models\Cotizacion;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Cotizaciones quincenales, oficiales (con alícuotas de regalía) y de referencia. Cada corrección queda registrada. */
class CotizacionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $c = Cotizacion::query()->with(['elemento:id,codigo,nombre', 'registradoPor:id,name'])
            ->when($request->filled('elemento_id'), fn ($q) => $q->where('elemento_id', $request->integer('elemento_id')))
            ->when($request->filled('tipo'), fn ($q) => $q->where('tipo', $request->query('tipo')))
            ->when($request->filled('anio'), fn ($q) => $q->where('anio', $request->integer('anio')))
            ->orderByDesc('anio')->orderByDesc('mes')->orderByDesc('quincena')->orderBy('elemento_id')->orderBy('tipo')
            ->limit(500)->get();

        return response()->json(['data' => $c]);
    }

    public function store(CotizacionRequest $request): JsonResponse
    {
        $c = Transaccion::como($request->user()->id,
            fn () => Cotizacion::create([...$request->validated(), 'registrado_por' => $request->user()->id])->refresh());

        return response()->json(['data' => $c->load('elemento:id,codigo,nombre'), 'mensaje' => 'Cotización registrada.'], 201);
    }

    public function update(CotizacionRequest $request, Cotizacion $cotizacion): JsonResponse
    {
        Transaccion::como($request->user()->id, fn () => $cotizacion->fill($request->validated())->save());

        return response()->json(['data' => $cotizacion->refresh()->load('elemento:id,codigo,nombre'),
                                 'mensaje' => 'Cotización corregida. El valor anterior queda en el historial.']);
    }

    public function destroy(Request $request, Cotizacion $cotizacion): JsonResponse
    {
        abort_unless($request->user()->can('cargas.cotizaciones'), 403);
        Transaccion::como($request->user()->id, fn () => $cotizacion->delete());

        return response()->json(['mensaje' => 'Cotización eliminada.']);
    }
}
