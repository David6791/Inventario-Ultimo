<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

/** Área operativa: PORCO, POTOSI, UNIFICADA. Agrupa centros de costo. */
class Area extends ActivoModel
{
    protected $table = 'activos.area';

    public $timestamps = true;

    protected $fillable = ['codigo', 'nombre', 'activo'];

    protected $casts = ['activo' => 'boolean'];

    public function centros(): HasMany
    {
        return $this->hasMany(CentroCosto::class, 'area_id');
    }

    public function scopeActivas($query)
    {
        return $query->where('activo', true);
    }
}
