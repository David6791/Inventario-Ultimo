<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Caja\Models\Caja;
use App\Modules\Cargas\Http\Requests\PagarBonoRequest;
use App\Modules\Cargas\Http\Requests\PublicarTramosRequest;
use App\Modules\Cargas\Models\BonoTramo;
use App\Modules\Cargas\Models\BonoTransporte;
use App\Modules\Cargas\Services\BonoTramoService;
use App\Modules\Cargas\Services\PagoBonoService;
use App\Modules\Cargas\Services\RecepcionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Tramos del bono de transporte y pago de los bonos por caja. */
class BonoController extends Controller
{
    /** Tabla vigente, próximas e historial. */
    public function tramos(): JsonResponse
    {
        $hoy = now()->toDateString();
        $tramos = BonoTramo::query()->orderByDesc('vigente_desde')->orderBy('peso_desde_kg')->get();

        $tablas = $tramos->groupBy(fn ($t) => $t->vigente_desde->toDateString())
            ->map(fn ($grupo, $desde) => [
                'vigente_desde' => $desde,
                'vigente_hasta' => $grupo->first()->vigente_hasta?->toDateString(),
                'estado'        => $desde > $hoy ? 'PROXIMA'
                    : (($grupo->first()->vigente_hasta === null || $grupo->first()->vigente_hasta->toDateString() > $hoy) ? 'VIGENTE' : 'ANTERIOR'),
                'tramos'        => $grupo->values(),
            ])->values();

        return response()->json(['data' => $tablas]);
    }

    public function publicar(PublicarTramosRequest $request, BonoTramoService $servicio): JsonResponse
    {
        $n = $servicio->publicar($request->input('vigente_desde'), $request->input('tramos'), $request->user());

        return response()->json(['mensaje' => "Tabla de {$n} tramos publicada, rige desde " . \Carbon\Carbon::parse($request->input('vigente_desde'))->format('d/m/Y') . '.'], 201);
    }

    /** Qué bono corresponde a un peso neto (para mostrarlo al pesar). */
    public function calcular(Request $request, RecepcionService $recepcion): JsonResponse
    {
        $peso = (float) $request->query('peso_neto_kg');

        return response()->json(['data' => $peso > 0 ? $recepcion->bonoPara($peso) : null]);
    }

    /** Bonos pendientes de pago de los lotes recibidos en la sede de la caja. */
    public function pendientes(Request $request): JsonResponse
    {
        $caja = Caja::findOrFail($request->integer('caja_id'));
        abort_unless($caja->esDelAmbitoDe($request->user()), 403, 'Su usuario no tiene acceso a esa caja.');

        $bonos = BonoTransporte::query()
            ->where('estado', BonoTransporte::PENDIENTE)
            ->whereHas('pesaje.lote', fn ($q) => $q->where('almacen_id', $caja->almacen_id))
            ->with(['pesaje:id,lote_id,ticket,placa,peso_neto_kg,fecha', 'pesaje.lote:id,codigo,productor_id', 'pesaje.lote.productor:id,nombre'])
            ->orderBy('created_at')
            ->get();

        return response()->json(['data' => $bonos]);
    }

    public function pagar(PagarBonoRequest $request, BonoTransporte $bono, PagoBonoService $pago): JsonResponse
    {
        $caja = Caja::findOrFail($request->integer('caja_id'));
        abort_unless($caja->esCajero($request->user()), 403,
            "No está asignado como cajero de la caja {$caja->codigo}. Pida que lo asignen en Caja → Cajas.");

        $movimiento = $pago->pagar($bono, $caja, $request->user());

        return response()->json([
            'data'    => $movimiento->load(['concepto:id,codigo,nombre,tipo,origen', 'registradoPor:id,name']),
            'mensaje' => "Bono pagado: comprobante {$movimiento->numero}.",
        ], 201);
    }
}
