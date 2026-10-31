<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Caja\Models\Caja;
use App\Modules\Cargas\Http\Requests\AgregarBonoRequest;
use App\Modules\Cargas\Http\Requests\PagarBonoRequest;
use App\Modules\Cargas\Models\Bono;
use App\Modules\Cargas\Models\Lote;
use App\Modules\Cargas\Services\PagoBonoService;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** Bonos de los lotes: los pendientes de cada caja, su pago, los de monto manual y su anulación. */
class BonoController extends Controller
{
    /** Bonos pendientes de los lotes recibidos en el acopio de la caja. */
    public function pendientes(Request $request): JsonResponse
    {
        $caja = Caja::findOrFail($request->integer('caja_id'));
        abort_unless($caja->esDelAmbitoDe($request->user()), 403, 'Su usuario no tiene acceso a esa caja.');

        $bonos = Bono::query()
            ->where('estado', Bono::PENDIENTE)
            ->whereHas('lote', fn ($q) => $q->where('almacen_id', $caja->almacen_id))
            ->with(['tipo:id,codigo,nombre,calculo,naturaleza,cobra,permite_otro',
                    'pesaje:id,lote_id,ticket,placa,peso_neto_kg,peso_bruto_kg,tara_kg,fecha',
                    'lote:id,codigo,material,productor_id,fecha_recepcion,origen', 'lote.productor:id,nombre,ci'])
            ->orderBy('created_at')->orderBy('id')
            ->get();

        return response()->json(['data' => $bonos]);
    }

    public function pagar(PagarBonoRequest $request, Bono $bono, PagoBonoService $pago): JsonResponse
    {
        $caja = Caja::findOrFail($request->integer('caja_id'));
        abort_unless($caja->esCajero($request->user()), 403,
            "No está asignado como cajero de la caja {$caja->codigo}. Pida que lo asignen en Caja → Cajas.");

        $m = $pago->pagar($bono, $caja, $request->user(), $request->input('beneficiario_nombre'), $request->input('beneficiario_ci'));

        return response()->json([
            'data'    => $m->load(['concepto:id,codigo,nombre,tipo,origen', 'registradoPor:id,name']),
            'mensaje' => "{$bono->tipo->nombre} pagado a {$m->persona_nombre}: comprobante {$m->numero}.",
        ], 201);
    }

    /** Bono de monto manual (del catálogo) para un lote. */
    public function agregar(AgregarBonoRequest $request, Lote $lote): JsonResponse
    {
        abort_unless($lote->esDelAmbitoDe($request->user()), 403, 'El lote es de una sede a la que su usuario no tiene acceso.');

        $bono = Transaccion::como($request->user()->id, fn () => Bono::create([
            'tipo_bono_id'        => $request->integer('tipo_bono_id'),
            'lote_id'             => $lote->id,
            'monto'               => $request->input('monto'),
            'moneda'              => $request->input('moneda') ?: 'BOB',
            'naturaleza'          => 'ANTICIPO',                    // la base copia la del catálogo
            'beneficiario_nombre' => $request->input('beneficiario_nombre'),
            'beneficiario_ci'     => $request->input('beneficiario_ci'),
            'observacion'         => $request->input('observacion'),
            'registrado_por'      => $request->user()->id,
        ])->refresh()->load('tipo:id,nombre'));

        return response()->json(['data' => $bono,
            'mensaje' => "{$bono->tipo->nombre} de {$bono->montoTexto()} agregado al lote {$lote->codigo}, por pagar en caja."], 201);
    }

    /** Anula un bono pendiente, con motivo. Los pagados no se anulan. */
    public function anular(Request $request, Bono $bono): JsonResponse
    {
        abort_unless($request->user()->can('cargas.anular-lote') || $request->user()->can('cargas.configurar-bono'), 403,
            'Su usuario no puede anular bonos.');
        abort_unless($bono->lote->esDelAmbitoDe($request->user()), 403, 'El lote es de una sede a la que su usuario no tiene acceso.');
        $motivo = trim((string) $request->input('motivo'));
        if (mb_strlen($motivo) < 5) {
            throw ValidationException::withMessages(['motivo' => 'Indique el motivo de la anulación (al menos 5 letras).']);
        }
        if ($bono->estado !== Bono::PENDIENTE) {
            throw ValidationException::withMessages(['bono' => "El bono ya está {$bono->estado}: solo se anulan los pendientes."]);
        }

        Transaccion::como($request->user()->id, fn () => $bono->forceFill([
            'estado' => Bono::ANULADO, 'anulado_por' => $request->user()->id, 'anulado_en' => now(), 'motivo_anulacion' => $motivo,
        ])->save());

        return response()->json(['data' => $bono->refresh(), 'mensaje' => "{$bono->tipo->nombre} del lote {$bono->lote->codigo} anulado."]);
    }
}
