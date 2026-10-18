<?php

namespace App\Modules\Caja\Http\Controllers;

use App\Modules\Caja\Models\Caja;

/**
 * Consultar una caja: la tienen asignada, es de su sede o administra cajas.
 * Operarla: solo sus cajeros asignados (la base también lo exige).
 */
trait AmbitoDeCaja
{
    protected function asegurarAmbito(Caja $caja): void
    {
        abort_unless(
            $caja->esDelAmbitoDe(request()->user()),
            403,
            "La caja {$caja->codigo} es de una sede a la que su usuario no tiene acceso."
        );
    }

    /** Operar (abrir, registrar, anular) exige estar asignado como cajero de esa caja. */
    protected function asegurarCajero(Caja $caja): void
    {
        abort_unless(
            $caja->esCajero(request()->user()),
            403,
            "No está asignado como cajero de la caja {$caja->codigo}. Pida que lo asignen en Caja → Cajas."
        );
    }
}
