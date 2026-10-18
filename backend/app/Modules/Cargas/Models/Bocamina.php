<?php

namespace App\Modules\Cargas\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Punto de extracción de una mina. Obligatoria en los lotes de producción propia. */
class Bocamina extends CargasModel
{
    protected $table = 'cargas.bocamina';

    protected $fillable = ['mina_id', 'codigo', 'nombre', 'activa'];

    protected $casts = [
        'activa'  => 'boolean',
        'mina_id' => 'integer',
    ];

    public function mina(): BelongsTo
    {
        return $this->belongsTo(Mina::class, 'mina_id');
    }
}
