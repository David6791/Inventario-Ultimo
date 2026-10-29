<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Caja\Models\Caja;
use App\Modules\Cargas\Http\Requests\PagarBonoLaboratorioRequest;
use App\Modules\Cargas\Http\Requests\PublicarTramosLaboratorioRequest;
use App\Modules\Cargas\Models\BonoLaboratorio;
use App\Modules\Cargas\Models\BonoLaboratorioTramo;
use App\Modules\Cargas\Services\PagoBonoLaboratorioService;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Tabla del bono de laboratorio y su pago por caja. */
class BonoLaboratorioController extends Controller
{
    /** Tabla vigente, próximas e historial. */
    public function tramos(): JsonResponse
    {
        $hoy = now()->toDateString();
        $tablas = BonoLaboratorioTramo::query()->orderByDesc('vigente_desde')->orderBy('num_elementos')->get()
            ->groupBy(fn ($t) => $t->vigente_desde->toDateString())
            ->map(fn ($g, $desde) => [
                'vigente_desde' => $desde,
                'vigente_hasta' => $g->first()->vigente_hasta?->toDateString(),
                'estado'        => $desde > $hoy ? 'PROXIMA'
                    : (($g->first()->vigente_hasta === null || $g->first()->vigente_hasta->toDateString() > $hoy) ? 'VIGENTE' : 'ANTERIOR'),
                'tramos'        => $g->values(),
            ])->values();

        return response()->json(['data' => $tablas]);
    }

    public function publicar(PublicarTramosLaboratorioRequest $request): JsonResponse
    {
        $u = $request->user();
        $n = Transaccion::como($u->id, fn () => (int) DB::selectOne(
            'select cargas.publicar_tramos_laboratorio(?::date, ?::jsonb, ?) as n',
            [$request->input('vigente_desde'), json_encode(array_values($request->input('tramos'))), $u->id]
        )->n);

        return response()->json(['mensaje' => "Tabla del bono de laboratorio publicada ({$n} filas), rige desde "
            . \Carbon\Carbon::parse($request->input('vigente_desde'))->format('d/m/Y') . '.'], 201);
    }

    /** Qué bono corresponde a un material hoy (para mostrarlo al recibir). */
    public function calcular(Request $request): JsonResponse
    {
        $material = (string) $request->query('material');
        $t = $material === '' ? null : DB::selectOne(
            'select t.* from cargas.bono_laboratorio_tramo t where t.id = cargas.tramo_laboratorio(cargas.num_elementos(?), current_date)',
            [$material]);

        return response()->json(['data' => $t ? ['num_elementos' => (int) $t->num_elementos, 'monto' => $t->monto, 'moneda' => $t->moneda] : null]);
    }

    /** Bonos de laboratorio pendientes de los lotes recibidos en la sede de la caja. */
    public function pendientes(Request $request): JsonResponse
    {
        $caja = Caja::findOrFail($request->integer('caja_id'));
        abort_unless($caja->esDelAmbitoDe($request->user()), 403, 'Su usuario no tiene acceso a esa caja.');

        $bonos = BonoLaboratorio::query()
            ->where('estado', BonoLaboratorio::PENDIENTE)
            ->whereHas('lote', fn ($q) => $q->where('almacen_id', $caja->almacen_id))
            ->with(['lote:id,codigo,material,productor_id,fecha_recepcion', 'lote.productor:id,nombre,ci'])
            ->orderBy('created_at')
            ->get();

        return response()->json(['data' => $bonos]);
    }

    public function pagar(PagarBonoLaboratorioRequest $request, BonoLaboratorio $bono, PagoBonoLaboratorioService $pago): JsonResponse
    {
        $caja = Caja::findOrFail($request->integer('caja_id'));
        abort_unless($caja->esCajero($request->user()), 403,
            "No está asignado como cajero de la caja {$caja->codigo}. Pida que lo asignen en Caja → Cajas.");

        $m = $pago->pagar($bono, $caja, $request->user(), $request->input('beneficiario_nombre'), $request->input('beneficiario_ci'));

        return response()->json([
            'data'    => $m->load(['concepto:id,codigo,nombre,tipo,origen', 'registradoPor:id,name']),
            'mensaje' => "Bono de laboratorio pagado a {$m->persona_nombre}: comprobante {$m->numero}.",
        ], 201);
    }
}
