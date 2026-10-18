<?php

namespace App\Modules\Cargas\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Quien entrega mineral. En el sistema anterior se llamaba «cliente». */
class Productor extends CargasModel
{
    protected $table = 'cargas.productor';

    protected $fillable = [
        'tipo', 'nombre', 'ci', 'nit', 'nim', 'telefono', 'domicilio', 'cooperativa_id', 'activo',
    ];

    protected $casts = [
        'activo'         => 'boolean',
        'cooperativa_id' => 'integer',
    ];

    public const TIPOS = ['COOPERATIVISTA', 'PARTICULAR', 'EMPRESA', 'INGENIO'];

    public function cooperativa(): BelongsTo
    {
        return $this->belongsTo(Cooperativa::class, 'cooperativa_id');
    }

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }

    /** Busca por nombre, CI, NIT o NIM, sin distinguir mayúsculas ni tildes. */
    public function scopeBuscar($query, ?string $texto)
    {
        $texto = trim((string) $texto);
        if ($texto === '') {
            return $query;
        }

        $patron = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $texto) . '%';

        return $query->where(fn ($q) => $q
            ->whereRaw('unaccent(nombre) ilike unaccent(?)', [$patron])
            ->orWhere('ci', 'ilike', $patron)
            ->orWhere('nit', 'ilike', $patron)
            ->orWhere('nim', 'ilike', $patron));
    }
}
