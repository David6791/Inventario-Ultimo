<?php

namespace App\Modules\Caja\Services;

use App\Models\User;
use App\Modules\Caja\Models\Movimiento;
use App\Modules\Caja\Models\MovimientoAjuste;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Support\Facades\DB;

/**
 * Comprobantes provisionales: ajuste del monto en el día y validación. Las
 * reglas están en la base (18_comprobante_provisional.sql); aquí solo se
 * llaman sus funciones con el usuario identificado.
 */
class AjusteService
{
    public function ajustar(Movimiento $movimiento, User $cajero, float|string $monto, string $motivo, ?string $documento): MovimientoAjuste
    {
        return $this->llamar($cajero, 'select (caja.ajustar_movimiento(?, ?, ?, ?, ?)).id as id',
            [$movimiento->id, $monto, $motivo, $documento, $cajero->id]);
    }

    public function resolver(MovimientoAjuste $ajuste, User $aprobador, bool $aprobar, ?string $observacion): MovimientoAjuste
    {
        return $this->llamar($aprobador, 'select (caja.resolver_ajuste(?, ?, ?, ?)).id as id',
            [$ajuste->id, $aprobar, $observacion, $aprobador->id]);
    }

    public function aplicar(MovimientoAjuste $ajuste, User $cajero): MovimientoAjuste
    {
        return $this->llamar($cajero, 'select (caja.aplicar_ajuste(?, ?)).id as id', [$ajuste->id, $cajero->id]);
    }

    public function validar(Movimiento $movimiento, User $cajero): Movimiento
    {
        Transaccion::como($cajero->id, fn () => DB::selectOne(
            'select (caja.validar_movimiento(?, ?)).id as id', [$movimiento->id, $cajero->id]
        ));

        return $movimiento->refresh();
    }

    private function llamar(User $usuario, string $sql, array $parametros): MovimientoAjuste
    {
        $id = Transaccion::como($usuario->id, fn () => DB::selectOne($sql, $parametros)->id);

        return MovimientoAjuste::findOrFail($id);
    }
}
