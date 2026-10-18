<?php

namespace App\Modules\Caja\Http\Controllers;

use App\Modules\Caja\Models\Caja;

/**
 * El cajero solo opera y consulta las cajas de sus sedes. Quien administra
 * cajas las ve todas.
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
}
