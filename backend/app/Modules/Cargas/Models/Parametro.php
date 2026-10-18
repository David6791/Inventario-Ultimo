<?php

namespace App\Modules\Cargas\Models;

/** Parámetro con historia de valores: cambiar un valor cierra el vigente y abre otro. */
class Parametro extends CargasModel
{
    protected $table = 'cargas.parametro';

    protected $fillable = ['clave', 'valor', 'tipo_dato', 'descripcion', 'vigente_desde', 'vigente_hasta'];

    protected $casts = [
        'vigente_desde' => 'date:Y-m-d',
        'vigente_hasta' => 'date:Y-m-d',
    ];

    public function scopeVigenteEl($query, string $clave, string $fecha)
    {
        return $query->where('clave', $clave)
            ->whereRaw("daterange(vigente_desde, vigente_hasta, '[)') @> ?::date", [$fecha]);
    }
}
