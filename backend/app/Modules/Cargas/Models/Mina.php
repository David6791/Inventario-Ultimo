<?php

namespace App\Modules\Cargas\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Mina de una cooperativa, de un particular o PROPIA de la empresa. */
class Mina extends CargasModel
{
    protected $table = 'cargas.mina';

    protected $fillable = ['nombre', 'propia', 'cooperativa_id', 'municipio_id', 'activa'];

    protected $casts = [
        'propia'         => 'boolean',
        'activa'         => 'boolean',
        'cooperativa_id' => 'integer',
        'municipio_id'   => 'integer',
    ];

    public function cooperativa(): BelongsTo
    {
        return $this->belongsTo(Cooperativa::class, 'cooperativa_id');
    }

    public function municipio(): BelongsTo
    {
        return $this->belongsTo(Municipio::class, 'municipio_id');
    }

    public function bocaminas(): HasMany
    {
        return $this->hasMany(Bocamina::class, 'mina_id');
    }

    public function scopeActivas($query)
    {
        return $query->where('activa', true);
    }

    /** Misma comparación que el índice ux_mina_nombre, dentro de la misma cooperativa. */
    public function scopeConNombre($query, string $nombre, ?int $cooperativaId)
    {
        return $query
            ->whereRaw(
                "upper(regexp_replace(btrim(nombre), '\\s+', ' ', 'g')) = upper(regexp_replace(btrim(?), '\\s+', ' ', 'g'))",
                [$nombre]
            )
            ->whereRaw('coalesce(cooperativa_id, 0) = ?', [$cooperativaId ?? 0]);
    }
}
