<?php

namespace App\Modules\Caja\Services;

use App\Models\User;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Concepto;
use App\Modules\Caja\Models\EnvioFondos;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Validation\ValidationException;

/**
 * Envío de dinero de la sede central a otra caja: cada paso registra su
 * comprobante y actualiza el envío en la misma transacción. Las reglas
 * (caja central, saldo, mismo monto y moneda) las vuelve a exigir la base.
 */
class EnvioFondosService
{
    public function __construct(private readonly CajaService $cajas)
    {
    }

    public function enviar(Caja $origen, Caja $destino, float $monto, string $moneda, string $motivo, ?string $entregadoA, User $cajero): EnvioFondos
    {
        $sesion = $this->sesionAbierta($origen, 'enviar');

        return Transaccion::como($cajero->id, function () use ($origen, $destino, $monto, $moneda, $motivo, $entregadoA, $cajero, $sesion) {
            $mov = $this->cajas->registrar($sesion, $cajero, [
                'concepto_id'    => Concepto::where('codigo', 'ENVIO_FONDOS')->value('id'),
                'monto'          => $monto,
                'moneda'         => $moneda,
                'forma_pago'     => 'EFECTIVO',
                'persona_nombre' => $entregadoA ?: mb_strtoupper("Caja {$destino->codigo} · {$destino->nombre}"),
                'glosa'          => mb_substr("Envío a la caja {$destino->codigo} · {$motivo}", 0, 250),
            ]);

            return EnvioFondos::create([
                'caja_origen_id' => $origen->id, 'caja_destino_id' => $destino->id, 'monto' => $monto, 'moneda' => $moneda,
                'motivo' => $motivo, 'entregado_a' => $entregadoA, 'movimiento_envio_id' => $mov->id, 'enviado_por' => $cajero->id,
            ])->refresh();
        });
    }

    public function recibir(EnvioFondos $envio, User $cajero): EnvioFondos
    {
        $this->enTransito($envio);
        $envio->loadMissing('origen', 'destino');
        $sesion = $this->sesionAbierta($envio->destino, 'recibir el envío');

        return Transaccion::como($cajero->id, function () use ($envio, $cajero, $sesion) {
            $mov = $this->cajas->registrar($sesion, $cajero, [
                'concepto_id'    => Concepto::where('codigo', 'RECEPCION_FONDOS')->value('id'),
                'monto'          => $envio->monto,
                'moneda'         => $envio->moneda,
                'forma_pago'     => 'EFECTIVO',
                'persona_nombre' => $envio->entregado_a ?: mb_strtoupper("Caja {$envio->origen->codigo} · {$envio->origen->nombre}"),
                'glosa'          => mb_substr("Recibido de la caja {$envio->origen->codigo} (envío {$envio->numero}) · {$envio->motivo}", 0, 250),
            ]);
            $envio->forceFill(['estado' => 'RECIBIDO', 'movimiento_recepcion_id' => $mov->id,
                               'recibido_por' => $cajero->id, 'recibido_en' => now()])->save();

            return $envio->refresh();
        });
    }

    public function anular(EnvioFondos $envio, User $cajero, string $motivo): EnvioFondos
    {
        $this->enTransito($envio);
        $envio->loadMissing('origen', 'destino');
        $sesion = $this->sesionAbierta($envio->origen, 'anular el envío (el dinero vuelve a ella)');

        return Transaccion::como($cajero->id, function () use ($envio, $cajero, $sesion, $motivo) {
            $mov = $this->cajas->registrar($sesion, $cajero, [
                'concepto_id'    => Concepto::where('codigo', 'REINTEGRO_FONDOS')->value('id'),
                'monto'          => $envio->monto,
                'moneda'         => $envio->moneda,
                'forma_pago'     => 'EFECTIVO',
                'persona_nombre' => $envio->entregado_a ?: mb_strtoupper("Caja {$envio->destino->codigo} · {$envio->destino->nombre}"),
                'glosa'          => mb_substr("Reintegro del envío {$envio->numero} anulado · {$motivo}", 0, 250),
            ]);
            $envio->forceFill(['estado' => 'ANULADO', 'movimiento_reintegro_id' => $mov->id, 'anulado_por' => $cajero->id,
                               'anulado_en' => now(), 'motivo_anulacion' => $motivo])->save();

            return $envio->refresh();
        });
    }

    private function enTransito(EnvioFondos $envio): void
    {
        if ($envio->estado !== EnvioFondos::EN_TRANSITO) {
            throw ValidationException::withMessages(['envio' => "El envío {$envio->numero} ya está {$envio->estado}."]);
        }
    }

    private function sesionAbierta(Caja $caja, string $para)
    {
        $sesion = $caja->sesionAbierta;
        if (! $sesion) {
            throw ValidationException::withMessages(['caja' => "La caja {$caja->codigo} está cerrada: ábrala para {$para}."]);
        }

        return $sesion;
    }
}
