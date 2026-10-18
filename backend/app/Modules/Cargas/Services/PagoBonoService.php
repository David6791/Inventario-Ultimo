<?php

namespace App\Modules\Cargas\Services;

use App\Models\User;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Concepto;
use App\Modules\Caja\Models\Movimiento;
use App\Modules\Caja\Services\CajaService;
use App\Modules\Cargas\Models\BonoTransporte;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Validation\ValidationException;

/**
 * Pago del bono de transporte por caja: el egreso BONO_TRANSPORTE y el bono
 * PAGADO quedan vinculados en la misma transacción. Si cualquiera falla
 * (saldo insuficiente, caja cerrada, bono ya pagado) no se guarda nada; la
 * base además rechaza un egreso de bono que quede sin su bono.
 */
class PagoBonoService
{
    public function __construct(private readonly CajaService $cajas)
    {
    }

    public function pagar(BonoTransporte $bono, Caja $caja, User $cajero): Movimiento
    {
        $bono->loadMissing('pesaje.lote');
        $lote = $bono->pesaje->lote;

        if ($bono->estado !== BonoTransporte::PENDIENTE) {
            throw ValidationException::withMessages(['bono' => "El bono ya está {$bono->estado}."]);
        }
        if ($lote->almacen_id !== $caja->almacen_id) {
            throw ValidationException::withMessages(['caja_id' =>
                "El lote {$lote->codigo} se recibió en otra sede: el bono se paga en la caja de esa sede."]);
        }

        $sesion = $caja->sesionAbierta;
        if (! $sesion) {
            throw ValidationException::withMessages(['caja_id' => "La caja {$caja->codigo} está cerrada: ábrala para pagar el bono."]);
        }

        return Transaccion::como($cajero->id, function () use ($bono, $sesion, $cajero, $lote) {
            $movimiento = $this->cajas->registrar($sesion, $cajero, [
                'concepto_id'    => Concepto::where('codigo', 'BONO_TRANSPORTE')->value('id'),
                'monto'          => $bono->monto,
                'moneda'         => $bono->moneda,
                'forma_pago'     => 'EFECTIVO',
                'persona_nombre' => mb_strtoupper($bono->beneficiario_nombre),
                'persona_ci'     => $bono->beneficiario_ci,
                'glosa'          => "Bono de transporte · lote {$lote->codigo} · ticket {$bono->pesaje->ticket}"
                                    . ($bono->pesaje->placa ? " · placa {$bono->pesaje->placa}" : ''),
            ]);

            $bono->forceFill(['estado' => BonoTransporte::PAGADO, 'movimiento_caja_id' => $movimiento->id])->save();

            return $movimiento;
        });
    }
}
