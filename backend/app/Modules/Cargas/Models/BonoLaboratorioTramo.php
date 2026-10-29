<?php

namespace App\Modules\Cargas\Models;

/** Monto del bono de laboratorio según cuántos elementos trae el material, con vigencia. */
class BonoLaboratorioTramo extends CargasModel
{
    protected $table = 'cargas.bono_laboratorio_tramo';

    protected $casts = [
        'num_elementos' => 'integer',
        'monto'         => 'decimal:2',
        'vigente_desde' => 'date',
        'vigente_hasta' => 'date',
    ];
}
