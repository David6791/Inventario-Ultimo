<?php

namespace App\Modules\Cargas\Models;

/** Tramo [ley_desde, ley_hasta) con precio por punto o porcentaje pagable. */
class TablaPrecioTramo extends CargasModel
{
    protected $table = 'cargas.tabla_precio_tramo';

    public $timestamps = false;

    protected $fillable = ['tabla_precio_id', 'ley_desde', 'ley_hasta', 'precio_punto', 'porcentaje_pagable'];

    protected $casts = [
        'tabla_precio_id'    => 'integer',
        'ley_desde'          => 'decimal:4',
        'ley_hasta'          => 'decimal:4',
        'precio_punto'       => 'decimal:4',
        'porcentaje_pagable' => 'decimal:3',
    ];
}
