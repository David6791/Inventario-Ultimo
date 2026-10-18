<?php

namespace App\Modules\Caja\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Sesión de caja: de la apertura al cierre. El número y el estado inicial los
 * pone la base; solo puede haber una sesión abierta por caja.
 */
class Sesion extends CajaModel
{
    protected $table = 'caja.sesion';

    protected $fillable = ['caja_id', 'abierta_por', 'observaciones'];

    protected $casts = [
        'caja_id'     => 'integer',
        'numero'      => 'integer',
        'abierta_en'  => 'datetime',
        'cerrada_en'  => 'datetime',
        'validada_en' => 'datetime',
    ];

    public const ABIERTA = 'ABIERTA';
    public const CERRADA = 'CERRADA';
    public const VALIDADA = 'VALIDADA';

    public function caja(): BelongsTo
    {
        return $this->belongsTo(Caja::class, 'caja_id');
    }

    public function saldos(): HasMany
    {
        return $this->hasMany(SesionSaldo::class, 'sesion_id')->orderBy('moneda');
    }

    public function movimientos(): HasMany
    {
        return $this->hasMany(Movimiento::class, 'sesion_id');
    }

    public function abiertaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'abierta_por');
    }

    public function cerradaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cerrada_por');
    }

    public function estaAbierta(): bool
    {
        return $this->estado === self::ABIERTA;
    }
}
