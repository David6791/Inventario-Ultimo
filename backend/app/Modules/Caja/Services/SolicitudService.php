<?php

namespace App\Modules\Caja\Services;

use App\Models\User;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Movimiento;
use App\Modules\Caja\Models\Sesion;
use App\Modules\Caja\Models\Solicitud;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Solicitudes de dinero de cajas con aprobación. Las reglas (quién aprueba,
 * que nadie apruebe lo suyo, que quien aprobó no pague, que se pague lo
 * aprobado) viven en la base (17_solicitudes_caja.sql).
 */
class SolicitudService
{
    /**
     * Registra la solicitud. Sin persona, la solicitud es a nombre de quien
     * la registra (su nombre y su CI de usuario).
     */
    public function registrar(User $usuario, array $datos): Solicitud
    {
        $aNombreDe = filled($datos['persona_id'] ?? null) || filled($datos['persona_nombre'] ?? null);

        return Transaccion::como($usuario->id, function () use ($usuario, $datos, $aNombreDe) {
            $solicitud = Solicitud::create([
                'caja_id'        => $datos['caja_id'],
                'concepto_id'    => $datos['concepto_id'],
                'monto'          => $datos['monto'],
                'moneda'         => $datos['moneda'],
                'glosa'          => $datos['glosa'],
                'persona_id'     => $aNombreDe ? ($datos['persona_id'] ?? null) : null,
                'persona_nombre' => $aNombreDe ? ($datos['persona_nombre'] ?? null) : $usuario->name,
                'persona_ci'     => $aNombreDe ? ($datos['persona_ci'] ?? null) : $usuario->ci,
                'registrado_por' => $usuario->id,
            ]);

            return $solicitud->refresh();
        });
    }

    public function aprobar(Solicitud $solicitud, User $aprobador, ?string $observacion): Solicitud
    {
        return $this->resolver($solicitud, $aprobador, Solicitud::APROBADA, $observacion);
    }

    public function rechazar(Solicitud $solicitud, User $aprobador, string $motivo): Solicitud
    {
        return $this->resolver($solicitud, $aprobador, Solicitud::RECHAZADA, $motivo);
    }

    public function anular(Solicitud $solicitud, User $usuario, string $motivo): Solicitud
    {
        return Transaccion::como($usuario->id, function () use ($solicitud, $usuario, $motivo) {
            $solicitud->forceFill([
                'estado'           => Solicitud::ANULADA,
                'anulado_por'      => $usuario->id,
                'anulado_en'       => now(),
                'motivo_anulacion' => $motivo,
            ])->save();

            return $solicitud->refresh();
        });
    }

    /**
     * La cajera entrega el dinero: emite el comprobante de egreso en la sesión
     * abierta. Monto, moneda, concepto y persona salen de la solicitud (la base
     * los impone); aquí solo se elige la forma de pago.
     */
    public function pagar(Solicitud $solicitud, Sesion $sesion, User $cajero, array $pago): Movimiento
    {
        return Transaccion::como($cajero->id, function () use ($solicitud, $sesion, $cajero, $pago) {
            $movimiento = Movimiento::create([
                'sesion_id'      => $sesion->id,
                'solicitud_id'   => $solicitud->id,
                'concepto_id'    => $solicitud->concepto_id,
                'monto'          => $solicitud->monto,
                'moneda'         => $solicitud->moneda,
                'persona_id'     => $solicitud->persona_id,
                'forma_pago'     => $pago['forma_pago'] ?? 'EFECTIVO',
                'banco_id'       => $pago['banco_id'] ?? null,
                'nro_documento'  => $pago['nro_documento'] ?? null,
                'provisional'    => (bool) ($pago['provisional'] ?? false),
                'glosa'          => Str::limit("Solicitud {$solicitud->numero}: {$solicitud->glosa}", 247),
                'registrado_por' => $cajero->id,
            ]);

            return $movimiento->refresh();
        });
    }

    /** Cambia el número con que sale el próximo comprobante del período actual. */
    public function fijarProximoComprobante(Caja $caja, int $proximo, User $usuario, ?string $motivo = null): ?string
    {
        return Transaccion::como($usuario->id, fn () => DB::selectOne(
            'select caja.fijar_proximo_comprobante(?, ?, ?, ?) as numero',
            [$caja->id, $proximo, $usuario->id, $motivo]
        )->numero);
    }

    public function ultimoComprobante(Caja $caja): int
    {
        return (int) DB::selectOne('select caja.ultimo_comprobante(?) as n', [$caja->id])->n;
    }

    private function resolver(Solicitud $solicitud, User $aprobador, string $estado, ?string $observacion): Solicitud
    {
        return Transaccion::como($aprobador->id, function () use ($solicitud, $aprobador, $estado, $observacion) {
            $solicitud->forceFill([
                'estado'       => $estado,
                'resuelto_por' => $aprobador->id,
                'resuelto_en'  => now(),
                'observacion'  => $observacion,
            ])->save();

            return $solicitud->refresh();
        });
    }
}
