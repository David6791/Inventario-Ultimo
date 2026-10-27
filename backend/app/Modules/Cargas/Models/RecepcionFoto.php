<?php

namespace App\Modules\Cargas\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Foto de un ticket o de la balanza manual. Se sube antes de guardar el pesaje
 * (para leerla) y queda ligada a él como respaldo: no cambia ni se borra.
 */
class RecepcionFoto extends CargasModel
{
    protected $table = 'cargas.recepcion_foto';

    public const UPDATED_AT = null;

    public const TIPOS = ['TICKET_INTERIOR', 'TICKET_EXTERIOR', 'BALANZA_MANUAL'];

    protected $fillable = ['tipo', 'ruta', 'ruta_original', 'plantilla_id', 'lectura', 'subida_por'];

    protected $hidden = ['ruta', 'ruta_original'];

    protected $casts = [
        'plantilla_id'   => 'integer',
        'pesaje_id'      => 'integer',
        'pesaje_saco_id' => 'integer',
        'subida_por'     => 'integer',
        'lectura'        => 'array',
    ];

    public function plantilla(): BelongsTo { return $this->belongsTo(PlantillaBascula::class, 'plantilla_id'); }
    public function pesaje(): BelongsTo { return $this->belongsTo(Pesaje::class, 'pesaje_id'); }
    public function pesajeSaco(): BelongsTo { return $this->belongsTo(PesajeSaco::class, 'pesaje_saco_id'); }
    public function subidaPor(): BelongsTo { return $this->belongsTo(User::class, 'subida_por'); }

    /** Sin ligar a ningún pesaje todavía. */
    public function suelta(): bool
    {
        return $this->pesaje_id === null && $this->pesaje_saco_id === null;
    }
}
