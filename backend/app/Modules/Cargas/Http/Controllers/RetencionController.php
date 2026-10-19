<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\TasaRetencionRequest;
use App\Modules\Cargas\Models\RetencionConcepto;
use App\Modules\Cargas\Services\PrecioService;
use Illuminate\Http\JsonResponse;

/** Retenciones: conceptos con su historial de tasas (general o por cooperativa). */
class RetencionController extends Controller
{
    public function index(): JsonResponse
    {
        $hoy = now()->toDateString();
        $conceptos = RetencionConcepto::query()->where('activo', true)->orderBy('id')
            ->with(['tasas.cooperativa:id,nombre', 'tasas.registradoPor:id,name'])->get()
            ->map(fn ($c) => [...$c->toArray(), 'tasas' => $c->tasas->map(fn ($t) => [...$t->toArray(),
                'vigente' => $t->vigente_desde->toDateString() <= $hoy && (! $t->vigente_hasta || $t->vigente_hasta->toDateString() > $hoy),
                'proxima' => $t->vigente_desde->toDateString() > $hoy,
            ])]);

        return response()->json(['data' => $conceptos]);
    }

    public function publicar(TasaRetencionRequest $request, PrecioService $precios): JsonResponse
    {
        $precios->publicarTasa($request->integer('concepto_id'), $request->filled('cooperativa_id') ? $request->integer('cooperativa_id') : null,
            (float) $request->input('porcentaje'), $request->input('vigente_desde'), $request->user());

        return response()->json(['mensaje' => 'Tasa registrada: rige desde el ' . date('d/m/Y', strtotime($request->input('vigente_desde'))) . '.'], 201);
    }
}
