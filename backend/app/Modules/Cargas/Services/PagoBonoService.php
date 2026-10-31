<?php

namespace App\Modules\Cargas\Services;

use App\Models\User;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Movimiento;
use App\Modules\Caja\Services\CajaService;
use App\Modules\Cargas\Models\Bono;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Validation\ValidationException;

/**
 * Pago de un bono del catálogo por la caja del acopio: el egreso (con el
 * concepto del bono) y el bono PAGADO quedan vinculados en la misma
 * transacción. Si cualquiera falla (saldo, caja cerrada, bono ya pagado) no se
 * guarda nada; la base además rechaza un egreso de bono sin su bono.
 */
class PagoBonoService
{
    public function __construct(private readonly CajaService $cajas)
    {
    }

    public function pagar(Bono $bono, Caja $caja, User $cajero, ?string $nombre = null, ?string $ci = null): Movimiento
    {
        $bono->loadMissing(['tipo', 'lote.productor', 'pesaje']);
        $tipo = $bono->tipo;
        $lote = $bono->lote;

        if ($bono->estado !== Bono::PENDIENTE) {
            throw ValidationException::withMessages(['bono' => "El {$this->nombre($bono)} ya está {$bono->estado}."]);
        }
        if ($lote->almacen_id !== $caja->almacen_id) {
            throw ValidationException::withMessages(['caja_id' =>
                "El lote {$lote->codigo} se recibió en otro acopio: el bono se paga en la caja de ese acopio."]);
        }
        $sesion = $caja->sesionAbierta;
        if (! $sesion) {
            throw ValidationException::withMessages(['caja_id' => "La caja {$caja->codigo} está cerrada: ábrala para pagar el bono."]);
        }

        $nombre = $nombre ?: $bono->beneficiario_nombre;
        $ci = $nombre === $bono->beneficiario_nombre ? ($ci ?? $bono->beneficiario_ci) : $ci;
        $nombre = $nombre === null ? null : mb_strtoupper(trim($nombre));
        if ($nombre === null || mb_strlen($nombre) < 3) {
            throw ValidationException::withMessages(['beneficiario_nombre' => "Indique quién cobra el {$this->nombre($bono)}."]);
        }
        $otro = $bono->beneficiario_nombre !== null && $nombre !== mb_strtoupper($bono->beneficiario_nombre);
        if ($otro && ! $tipo->permite_otro) {
            throw ValidationException::withMessages(['beneficiario_nombre' =>
                "El {$this->nombre($bono)} lo cobra solo {$bono->beneficiario_nombre}: el catálogo no permite que cobre otra persona."]);
        }

        $glosa = "{$tipo->nombre} · lote {$lote->codigo}"
            . ($bono->pesaje ? " · ticket {$bono->pesaje->ticket}" . ($bono->pesaje->placa ? " · placa {$bono->pesaje->placa}" : '') : '')
            . ($tipo->calculo === 'POR_ELEMENTOS' && $lote->material ? " · {$lote->material}" : '')
            . ($otro ? ' · por cuenta de ' . mb_strtoupper($bono->beneficiario_nombre) : '');

        return Transaccion::como($cajero->id, function () use ($bono, $tipo, $sesion, $cajero, $nombre, $ci, $glosa) {
            $movimiento = $this->cajas->registrar($sesion, $cajero, [
                'concepto_id'    => $tipo->concepto_id,
                'monto'          => $bono->monto,
                'moneda'         => $bono->moneda,
                'forma_pago'     => 'EFECTIVO',
                'persona_nombre' => $nombre,
                'persona_ci'     => $ci,
                'glosa'          => mb_substr($glosa, 0, 250),
            ]);

            $bono->forceFill(['beneficiario_nombre' => $nombre, 'beneficiario_ci' => $ci])->save();
            $bono->forceFill(['estado' => Bono::PAGADO, 'movimiento_caja_id' => $movimiento->id])->save();

            return $movimiento;
        });
    }

    private function nombre(Bono $bono): string
    {
        return mb_strtolower($bono->tipo->nombre);
    }
}
