<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Área de la institución que solicita material. */
class UnidadSolicitante extends Model
{
    protected $table = 'unidades_solicitantes';

    protected $fillable = [
        'codigo', 'nombre', 'responsable', 'centro_costo', 'activo',
    ];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function solicitantes(): HasMany
    {
        return $this->hasMany(Solicitante::class);
    }

    public function salidas(): HasMany
    {
        return $this->hasMany(Salida::class);
    }

    public function scopeActivas($query)
    {
        return $query->where('activo', true);
    }

    /** No se elimina una unidad con gente o con movimientos. */
    public function puedeEliminarse(): bool
    {
        return $this->solicitantes()->count() === 0
            && $this->salidas()->withoutGlobalScopes()->count() === 0;
    }
}
