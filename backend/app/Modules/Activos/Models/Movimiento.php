<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Bitácora inmutable del activo. Se escribe, nunca se edita ni se borra.
 * Una corrección genera un movimiento nuevo, no modifica el anterior.
 */
class Movimiento extends ActivoModel
{
    protected $table = 'activos.movimiento';

    protected $fillable = [
        'activo_id', 'documento_id', 'tipo', 'fecha',
        'custodio_anterior_id', 'custodio_nuevo_id',
        'ubicacion_anterior_id', 'ubicacion_nueva_id',
        'estado_anterior', 'estado_nuevo', 'detalle', 'usuario_id',
    ];

    protected $casts = [
        'fecha'   => 'datetime',
        'detalle' => 'array',
    ];

    public function activo(): BelongsTo
    {
        return $this->belongsTo(Activo::class, 'activo_id');
    }
}
