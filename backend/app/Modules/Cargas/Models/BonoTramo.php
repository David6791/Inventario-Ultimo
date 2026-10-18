<?php

namespace App\Modules\Cargas\Models;

/** Tramo de peso del bono de transporte, con vigencia: [desde, hasta). */
class BonoTramo extends CargasModel
{
    protected $table = 'cargas.bono_transporte_tramo';

    protected $fillable = ['tipo_vehiculo', 'peso_desde_kg', 'peso_hasta_kg', 'monto', 'moneda', 'vigente_desde', 'vigente_hasta'];

    protected $casts = [
        'peso_desde_kg' => 'decimal:2',
        'peso_hasta_kg' => 'decimal:2',
        'monto'         => 'decimal:2',
        'vigente_desde' => 'date:Y-m-d',
        'vigente_hasta' => 'date:Y-m-d',
    ];
}
