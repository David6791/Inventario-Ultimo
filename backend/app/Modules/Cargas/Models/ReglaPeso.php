<?php

namespace App\Modules\Cargas\Models;

/** Regla del peso que vale: tramo de la diferencia cliente − empresa y su fórmula, con vigencia. */
class ReglaPeso extends CargasModel
{
    protected $table = 'cargas.regla_peso';

    protected $casts = [
        'orden'         => 'integer',
        'desde'         => 'decimal:2',
        'hasta'         => 'decimal:2',
        'vigente_desde' => 'date',
        'vigente_hasta' => 'date',
    ];
}
