<?php

namespace App\Modules\Cargas\Models;

/**
 * Elemento químico (o la humedad). Toda ley de un elemento se guarda en su
 * unidad_ley. La base impide cambiar la unidad cuando ya hay análisis,
 * leyes, precios o cotizaciones registrados.
 */
class Elemento extends CargasModel
{
    protected $table = 'cargas.elemento';

    protected $fillable = ['codigo', 'nombre', 'unidad_ley', 'unidad_cotizacion', 'activo'];

    protected $casts = ['activo' => 'boolean'];

    public const UNIDADES_LEY = [
        '%'     => 'Porcentaje',
        'DM'    => 'Decimarcos',
        'G_TM'  => 'Gramos por tonelada',
        'OZ_TM' => 'Onzas por tonelada',
        'PPM'   => 'Partes por millón',
    ];

    public const UNIDADES_COTIZACION = [
        'LF'  => 'Libra fina',
        'OT'  => 'Onza troy',
        'TMF' => 'Tonelada métrica fina',
        'TM'  => 'Tonelada métrica',
    ];
}
