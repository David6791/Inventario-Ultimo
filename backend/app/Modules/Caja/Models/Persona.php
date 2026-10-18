<?php

namespace App\Modules\Caja\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Persona o empresa a quien la caja paga o de quien recibe dinero. La base la
 * crea sola al registrar un movimiento con un nombre o CI que no conoce.
 */
class Persona extends CajaModel
{
    protected $table = 'caja.persona';

    protected $fillable = ['nombre', 'ci', 'telefono', 'observaciones', 'activo'];

    protected $casts = ['activo' => 'boolean'];

    public function movimientos(): HasMany
    {
        return $this->hasMany(Movimiento::class, 'persona_id');
    }

    /** Por nombre (sin importar tildes ni mayúsculas) o por el comienzo del CI. */
    public function scopeBuscar(Builder $query, ?string $texto): Builder
    {
        $texto = trim((string) $texto);
        if ($texto === '') {
            return $query;
        }

        $patron = '%' . preg_replace('/\s+/u', '%', $texto) . '%';

        return $query->where(fn ($q) => $q
            ->whereRaw('unaccent(nombre) ilike unaccent(?)', [$patron])
            ->orWhere('ci', 'ilike', $texto . '%'));
    }
}
