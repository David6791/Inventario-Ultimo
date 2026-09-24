<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Persona que solicita o retira material.
 *
 * Separada de `users` a propósito: la mayoría nunca entra al sistema. Atarlas a
 * usuarios obligaría a crear logins que nadie usa.
 */
class Solicitante extends Model
{
    protected $table = 'solicitantes';

    protected $fillable = [
        'unidad_solicitante_id', 'nombre', 'ci', 'cargo',
        'telefono', 'autorizado_retirar', 'activo',
    ];

    protected function casts(): array
    {
        return [
            'autorizado_retirar' => 'boolean',
            'activo'             => 'boolean',
        ];
    }

    public function unidad(): BelongsTo
    {
        return $this->belongsTo(UnidadSolicitante::class, 'unidad_solicitante_id');
    }

    public function salidasSolicitadas(): HasMany
    {
        return $this->hasMany(Salida::class, 'solicitante_id');
    }

    public function salidasRetiradas(): HasMany
    {
        return $this->hasMany(Salida::class, 'recibido_por_id');
    }

    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('activo', true);
    }

    /** Solo los habilitados para retirar aparecen en el campo "quien recibe". */
    public function scopeQuePuedenRetirar(Builder $query): Builder
    {
        return $query->where('autorizado_retirar', true);
    }

    /**
     * Una persona con movimientos no se elimina: los documentos la referencian.
     * Se desactiva.
     */
    public function tieneMovimientos(): bool
    {
        return $this->salidasSolicitadas()->withoutGlobalScopes()->exists()
            || $this->salidasRetiradas()->withoutGlobalScopes()->exists();
    }
}
