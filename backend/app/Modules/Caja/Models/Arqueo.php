<?php

namespace App\Modules\Caja\Models;

/** Una fila del arqueo: cuántos billetes o monedas de un corte se contaron. */
class Arqueo extends CajaModel
{
    protected $table = 'caja.arqueo';

    public $timestamps = false;

    protected $fillable = ['sesion_id', 'moneda', 'denominacion', 'cantidad'];

    protected $casts = [
        'denominacion' => 'decimal:2',
        'cantidad'     => 'integer',
        'subtotal'     => 'decimal:2',
    ];
}
