<?php

namespace App\Modules\Cargas\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

/** Municipio productor: reparte la regalía minera (85 % Gobernación, 15 % municipio). */
class Municipio extends CargasModel
{
    protected $table = 'cargas.municipio';

    protected $fillable = ['codigo', 'nombre', 'departamento'];

    public const DEPARTAMENTOS = [
        'CHUQUISACA', 'LA PAZ', 'COCHABAMBA', 'ORURO', 'POTOSI',
        'TARIJA', 'SANTA CRUZ', 'BENI', 'PANDO',
    ];

    public function cooperativas(): HasMany
    {
        return $this->hasMany(Cooperativa::class, 'municipio_id');
    }

    public function minas(): HasMany
    {
        return $this->hasMany(Mina::class, 'municipio_id');
    }
}
