<?php

namespace App\Modules\Cargas\Models;

/** Porción de la muestra (empresa, productor o testigo para la dirimencia) con su precinto. */
class MuestraPorcion extends CargasModel
{
    protected $table = 'cargas.muestra_porcion';

    public $timestamps = false;

    protected $fillable = ['muestra_id', 'destino', 'precinto', 'entregada_a', 'entregada_en'];

    protected $casts = ['muestra_id' => 'integer', 'entregada_en' => 'datetime'];

    public const DESTINOS = ['EMPRESA', 'PRODUCTOR', 'TESTIGO'];
}
