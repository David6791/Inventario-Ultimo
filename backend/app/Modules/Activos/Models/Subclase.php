<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subclase extends ActivoModel
{
    protected $table = 'activos.subclase';

    protected $fillable = [
        'clase_id', 'codigo', 'nombre', 'vida_util_economica_meses', 'activo',
    ];

    protected $casts = [
        'activo'                    => 'boolean',
        'clase_id'                  => 'integer',
        'vida_util_economica_meses' => 'integer',
    ];

    public function clase(): BelongsTo
    {
        return $this->belongsTo(Clase::class, 'clase_id');
    }

    public function scopeActivas($query)
    {
        return $query->where('activo', true);
    }
}
