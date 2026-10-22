<?php

namespace App\Modules\Caja\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Caja\Http\Requests\AnularSolicitudRequest;
use App\Modules\Caja\Http\Requests\PagarSolicitudRequest;
use App\Modules\Caja\Http\Requests\ResolverSolicitudRequest;
use App\Modules\Caja\Http\Requests\SolicitudRequest;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Concepto;
use App\Modules\Caja\Models\Solicitud;
use App\Modules\Caja\Services\CajaService;
use App\Modules\Caja\Services\SolicitudService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Solicitudes de dinero: el solicitante pide, el aprobador de la caja aprueba
 * o rechaza, y la cajera paga las aprobadas emitiendo el comprobante.
 */
class SolicitudController extends Controller
{
    use AmbitoDeCaja;

    private const RELACIONES = [
        'caja:id,codigo,nombre', 'concepto:id,codigo,nombre', 'registradoPor:id,name',
        'resueltoPor:id,name', 'anuladoPor:id,name', 'movimiento:id,numero,estado,fecha',
    ];

    public function __construct(
        private readonly SolicitudService $solicitudes,
        private readonly CajaService $cajas,
    ) {
    }

    /** Cajas y conceptos para el formulario de solicitud. */
    public function opciones(Request $request): JsonResponse
    {
        $usuario = $request->user();
        abort_unless($usuario->can('caja.solicitar') || $usuario->can('caja.registrar'), 403);

        $cajas = Caja::query()
            ->where('activa', true)
            ->where('requiere_aprobacion', true)
            ->with(['almacen:id,nombre', 'cajeros:id'])
            ->orderBy('codigo')
            ->get()
            ->map(fn (Caja $c) => [
                'id' => $c->id, 'codigo' => $c->codigo, 'nombre' => $c->nombre, 'sede' => $c->almacen?->nombre,
                'monedas' => $c->monedas(),
                'soy_cajero' => $usuario->can('caja.registrar') && $c->cajeros->contains('id', $usuario->id),
            ])
            ->filter(fn ($c) => $usuario->can('caja.solicitar') || $c['soy_cajero'])
            ->values();

        return response()->json(['data' => [
            'cajas'     => $cajas,
            'conceptos' => Concepto::query()
                ->where('origen', Concepto::MANUAL)->where('tipo', 'EGRESO')->where('activo', true)
                ->where('exento_aprobacion', false)
                ->orderBy('nombre')->get(['id', 'codigo', 'nombre']),
            'puede_a_nombre_de' => $cajas->contains('soy_cajero', true),
            'puede_solicitar'   => $usuario->can('caja.solicitar'),
        ]]);
    }

    /** Las solicitudes que registró el usuario. */
    public function mias(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('caja.solicitar') || $request->user()->can('caja.registrar'), 403);

        return response()->json(['data' => Solicitud::query()
            ->where('registrado_por', $request->user()->id)
            ->with(self::RELACIONES)
            ->orderByDesc('id')
            ->limit(200)
            ->get()]);
    }

    /** Bandeja del aprobador: solicitudes de las cajas que tiene asignadas. */
    public function porAprobar(Request $request): JsonResponse
    {
        $usuario = $request->user();
        abort_unless($usuario->can('caja.aprobar'), 403);

        $estado = $request->input('estado', Solicitud::PENDIENTE);

        $consulta = Solicitud::query()
            ->whereIn('caja_id', fn ($q) => $q->select('caja_id')->from('caja.caja_aprobador')->where('user_id', $usuario->id))
            ->with(self::RELACIONES)
            ->when($estado === Solicitud::PENDIENTE,
                fn ($q) => $q->where('estado', Solicitud::PENDIENTE)->orderBy('id'),
                fn ($q) => $q->where('resuelto_por', $usuario->id)->orderByDesc('resuelto_en')->limit(200));

        return response()->json([
            'data' => $consulta->get()->map(fn (Solicitud $s) => [
                ...$s->toArray(),
                'es_mia' => $s->registrado_por === $usuario->id
                    || ($usuario->ci && $s->persona_ci && mb_strtoupper(trim($usuario->ci)) === $s->persona_ci),
            ]),
            // Aumentos de comprobantes provisionales por aprobar (solo en la vista de pendientes).
            'ajustes' => $estado === Solicitud::PENDIENTE
                ? \App\Modules\Caja\Models\MovimientoAjuste::query()
                    ->where('estado', 'PENDIENTE')
                    ->whereHas('movimiento', fn ($m) => $m->whereIn('caja_id',
                        fn ($q) => $q->select('caja_id')->from('caja.caja_aprobador')->where('user_id', $usuario->id)))
                    ->with(['movimiento:id,numero,caja_id,concepto_id,monto,moneda,persona_nombre,persona_ci,glosa,registrado_por,solicitud_id',
                            'movimiento.caja:id,codigo', 'movimiento.concepto:id,nombre', 'registradoPor:id,name'])
                    ->orderBy('id')->get()
                    ->map(fn ($a) => [...$a->toArray(), 'es_mio' => in_array($usuario->id, [$a->registrado_por, $a->movimiento->registrado_por], true)
                        || ($usuario->ci && $a->movimiento->persona_ci && mb_strtoupper(trim($usuario->ci)) === $a->movimiento->persona_ci)])
                : [],
            'cajas' => $usuario->can('caja.aprobar')
                ? Caja::whereIn('id', fn ($q) => $q->select('caja_id')->from('caja.caja_aprobador')->where('user_id', $usuario->id))
                    ->orderBy('codigo')->get(['id', 'codigo', 'nombre'])
                : [],
        ]);
    }

    /** Solicitudes de una caja (la cajera ve las aprobadas por pagar). */
    public function deCaja(Request $request, Caja $caja): JsonResponse
    {
        $this->asegurarAmbito($caja);

        $estados = array_intersect(explode(',', (string) $request->input('estado', 'APROBADA')), Solicitud::ESTADOS);

        return response()->json(['data' => $caja->solicitudes()
            ->whereIn('estado', $estados ?: [Solicitud::APROBADA])
            ->with(self::RELACIONES)
            ->orderBy('id')
            ->limit(300)
            ->get()]);
    }

    public function store(SolicitudRequest $request): JsonResponse
    {
        $solicitud = $this->solicitudes->registrar($request->user(), $request->validated());

        return response()->json([
            'data'    => $solicitud->load(self::RELACIONES),
            'mensaje' => "Solicitud {$solicitud->numero} registrada: queda pendiente de aprobación.",
        ], 201);
    }

    public function aprobar(ResolverSolicitudRequest $request, Solicitud $solicitud): JsonResponse
    {
        $solicitud = $this->solicitudes->aprobar($solicitud, $request->user(), $request->input('observacion'));

        return response()->json([
            'data'    => $solicitud->load(self::RELACIONES),
            'mensaje' => "Solicitud {$solicitud->numero} aprobada: la cajera ya puede pagarla.",
        ]);
    }

    public function rechazar(ResolverSolicitudRequest $request, Solicitud $solicitud): JsonResponse
    {
        $solicitud = $this->solicitudes->rechazar($solicitud, $request->user(), $request->input('observacion'));

        return response()->json([
            'data'    => $solicitud->load(self::RELACIONES),
            'mensaje' => "Solicitud {$solicitud->numero} rechazada.",
        ]);
    }

    public function anular(AnularSolicitudRequest $request, Solicitud $solicitud): JsonResponse
    {
        $solicitud = $this->solicitudes->anular($solicitud, $request->user(), $request->input('motivo'));

        return response()->json([
            'data'    => $solicitud->load(self::RELACIONES),
            'mensaje' => "Solicitud {$solicitud->numero} anulada.",
        ]);
    }

    /** La cajera entrega el dinero: comprobante en la sesión abierta de la caja. */
    public function pagar(PagarSolicitudRequest $request, Solicitud $solicitud): JsonResponse
    {
        $caja = $solicitud->caja;
        $this->asegurarCajero($caja);

        $sesion = $caja->sesionAbierta;
        abort_if($sesion === null, 422, "La caja {$caja->codigo} no tiene una sesión abierta: ábrala para pagar.");

        $movimiento = $this->solicitudes->pagar($solicitud, $sesion, $request->user(), $request->validated());

        return response()->json([
            'data'    => $movimiento->load(['concepto:id,codigo,nombre,tipo,origen', 'persona:id,nombre,ci', 'solicitud:id,numero']),
            'saldos'  => $this->cajas->resumen($sesion),
            'mensaje' => "Solicitud {$solicitud->numero} pagada con el comprobante {$movimiento->numero}.",
        ], 201);
    }
}
