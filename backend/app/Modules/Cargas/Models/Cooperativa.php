<?php

namespace App\Modules\Cargas\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cooperativa extends CargasModel
{
    protected $table = 'cargas.cooperativa';

    protected $fillable = ['nombre', 'sigla', 'nit', 'nim', 'municipio_id', 'activa'];

    protected $casts = [
        'activa'       => 'boolean',
        'municipio_id' => 'integer',
    ];

    public function municipio(): BelongsTo
    {
        return $this->belongsTo(Municipio::class, 'municipio_id');
    }

    public function productores(): HasMany
    {
        return $this->hasMany(Productor::class, 'cooperativa_id');
    }

    public function minas(): HasMany
    {
        return $this->hasMany(Mina::class, 'cooperativa_id');
    }

    public function scopeActivas($query)
    {
        return $query->where('activa', true);
    }

    /**
     * Misma comparación que el índice ux_cooperativa_nombre: sin mayúsculas y
     * con los espacios colapsados. «Cerro Rico  R.L.» = «CERRO RICO R.L.».
     */
    public function scopeConNombre($query, string $nombre)
    {
        return $query->whereRaw(
            "upper(regexp_replace(btrim(nombre), '\\s+', ' ', 'g')) = upper(regexp_replace(btrim(?), '\\s+', ' ', 'g'))",
            [$nombre]
        );
    }

    public static function normalizar(string $nombre): string
    {
        return mb_strtoupper(preg_replace('/\s+/u', ' ', trim($nombre)));
    }
}
