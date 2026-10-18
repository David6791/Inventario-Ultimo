<?php

namespace App\Modules\Comun\Models;

class Banco extends ComunModel
{
    protected $table = 'comun.banco';

    protected $fillable = ['nombre', 'activo'];

    protected $casts = ['activo' => 'boolean'];

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }
}
