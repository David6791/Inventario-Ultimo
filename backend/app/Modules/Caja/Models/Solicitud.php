<?php

namespace App\Modules\Caja\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Solicitud de dinero de una caja con aprobación.
 *
 *   PENDIENTE → APROBADA → PAGADA      (la cajera emite el comprobante)
 *             ↘ RECHAZADA              (con motivo)
 *   PENDIENTE o APROBADA → ANULADA     (con motivo)
 *
 * El número, el estado inicial y los datos de la persona los pone la base;
 * también exige que aprueben los aprobadores de la caja, que nadie apruebe lo
 * suyo y que quien aprobó no pague.
 */
class Solicitud extends CajaModel
{
    protected $table = 'caja.solicitud';

    protected $fillable = [
        'caja_id', 'concepto_id', 'monto', 'moneda', 'persona_id', 'persona_nombre', 'persona_ci',
        'glosa', 'registrado_por',
    ];

    protected $casts = [
        'caja_id'       => 'integer',
        'concepto_id'   => 'integer',
        'persona_id'    => 'integer',
        'registrado_por' => 'integer',
        'resuelto_por'  => 'integer',
        'movimiento_id' => 'integer',
        'monto'         => 'decimal:2',
        'registrado_en' => 'datetime',
        'resuelto_en'   => 'datetime',
        'anulado_en'    => 'datetime',
    ];

    public const PENDIENTE = 'PENDIENTE';
    public const APROBADA = 'APROBADA';
    public const RECHAZADA = 'RECHAZADA';
    public const PAGADA = 'PAGADA';
    public const ANULADA = 'ANULADA';
    public const ESTADOS = [self::PENDIENTE, self::APROBADA, self::RECHAZADA, self::PAGADA, self::ANULADA];

    public function caja(): BelongsTo
    {
        return $this->belongsTo(Caja::class, 'caja_id');
    }

    public function concepto(): BelongsTo
    {
        return $this->belongsTo(Concepto::class, 'concepto_id');
    }

    public function persona(): BelongsTo
    {
        return $this->belongsTo(Persona::class, 'persona_id');
    }

    public function movimiento(): BelongsTo
    {
        return $this->belongsTo(Movimiento::class, 'movimiento_id');
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    public function resueltoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resuelto_por');
    }

    public function anuladoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'anulado_por');
    }
}
