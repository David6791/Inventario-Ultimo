<?php

namespace App\Modules\Cargas\Models;

class Laboratorio extends CargasModel
{
    protected $table = 'cargas.laboratorio';

    protected $fillable = ['nombre', 'nit', 'propio', 'acreditado', 'activo'];

    protected $casts = [
        'propio'     => 'boolean',
        'acreditado' => 'boolean',
        'activo'     => 'boolean',
    ];
}
