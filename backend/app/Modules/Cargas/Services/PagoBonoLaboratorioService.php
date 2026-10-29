<?php

namespace App\Modules\Cargas\Services;

use App\Models\User;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Concepto;
use App\Modules\Caja\Models\Movimiento;
use App\Modules\Caja\Services\CajaService;
use App\Modules\Cargas\Models\BonoLaboratorio;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Validation\ValidationException;

/**
 * Pago del bono de laboratorio por caja: el egreso BONO_LABORATORIO a nombre
 * de quien cobra y el bono PAGADO, en la misma transacción.
 */
class PagoBonoLaboratorioService
{
    public function __construct(private readonly CajaService $cajas)
    {
    }

    public function pagar(BonoLaboratorio $bono, Caja $caja, User $cajero, string $nombre, ?string $ci): Movimiento
    {
        $bono->loadMissing('lote.productor');
        $lote = $bono->lote;

        if ($bono->estado !== BonoLaboratorio::PENDIENTE) {
            throw ValidationException::withMessages(['bono' => "El bono de laboratorio ya está {$bono->estado}."]);
        }
        if ($lote->almacen_id !== $caja->almacen_id) {
            throw ValidationException::withMessages(['caja_id' =>
                "El lote {$lote->codigo} se recibió en otra sede: el bono se paga en la caja de esa sede."]);
        }
        $sesion = $caja->sesionAbierta;
        if (! $sesion) {
            throw ValidationException::withMessages(['caja_id' => "La caja {$caja->codigo} está cerrada: ábrala para pagar el bono."]);
        }

        $esProductor = $lote->productor && mb_strtoupper($lote->productor->nombre) === $nombre;

        return Transaccion::como($cajero->id, function () use ($bono, $sesion, $cajero, $lote, $nombre, $ci, $esProductor) {
            $movimiento = $this->cajas->registrar($sesion, $cajero, [
                'concepto_id'    => Concepto::where('codigo', 'BONO_LABORATORIO')->value('id'),
                'monto'          => $bono->monto,
                'moneda'         => $bono->moneda,
                'forma_pago'     => 'EFECTIVO',
                'persona_nombre' => $nombre,
                'persona_ci'     => $ci,
                'glosa'          => "Bono de laboratorio · lote {$lote->codigo} · {$lote->material}"
                                    . ($esProductor ? '' : ' · por cuenta de ' . mb_strtoupper((string) $lote->productor?->nombre)),
            ]);

            $bono->forceFill(['estado' => BonoLaboratorio::PAGADO, 'movimiento_caja_id' => $movimiento->id,
                              'beneficiario_nombre' => $nombre, 'beneficiario_ci' => $ci])->save();

            return $movimiento;
        });
    }
}
