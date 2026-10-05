<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Valuación de un activo en un período, por tipo.
 *
 * Dos filas por activo y por mes: FINANCIERA e IMPOSITIVA.
 *
 * Las dos comparten la actualización por UFV —los estados financieros base
 * del IUE se expresan en moneda constante— y difieren en tres cosas: la vida
 * útil aplicada, el régimen (regular o DS 5563) y la porción de depreciación
 * proveniente de revalúos, que no es deducible.
 *
 * La valuación NO vive en la tabla `activo`: es histórica por período. Así
 * reconstruir un cierre pasado es una consulta y no una reversión.
 */
class Valuacion extends ActivoModel
{
    protected $table = 'activos.valuacion';

    public $timestamps = false;

    public const FINANCIERA = 'FINANCIERA';
    public const IMPOSITIVA = 'IMPOSITIVA';

    protected $fillable = [
        'cierre_id', 'activo_id', 'periodo', 'tipo',
        'valor_base_inicial', 'actualizacion', 'incremento_revaluo',
        'incremento_mejora', 'ajuste_valor_recuperable', 'valor_base_final',
        'dep_acum_inicial', 'dep_actualizacion', 'dep_periodo',
        'dep_periodo_no_deducible', 'dep_acum_final',
        'meses_depreciados', 'vida_util_meses',
    ];

    protected $casts = [
        'periodo'                  => 'date',
        'valor_base_inicial'       => 'decimal:2',
        'actualizacion'            => 'decimal:2',
        'incremento_revaluo'       => 'decimal:2',
        'incremento_mejora'        => 'decimal:2',
        'ajuste_valor_recuperable' => 'decimal:2',
        'valor_base_final'         => 'decimal:2',
        'dep_acum_inicial'         => 'decimal:2',
        'dep_actualizacion'        => 'decimal:2',
        'dep_periodo'              => 'decimal:2',
        'dep_periodo_no_deducible' => 'decimal:2',
        'dep_acum_final'           => 'decimal:2',
        'valor_neto'               => 'decimal:2',
    ];

    public function activo(): BelongsTo
    {
        return $this->belongsTo(Activo::class, 'activo_id');
    }

    public function cierre(): BelongsTo
    {
        return $this->belongsTo(Cierre::class, 'cierre_id');
    }

    public function scopeFinanciera($query) { return $query->where('tipo', self::FINANCIERA); }
    public function scopeImpositiva($query) { return $query->where('tipo', self::IMPOSITIVA); }

    /** Lo efectivamente deducible del IUE en el período. */
    public function getDepDeducibleAttribute(): float
    {
        return round((float) $this->dep_periodo - (float) $this->dep_periodo_no_deducible, 2);
    }

    public function totalmenteDepreciado(): bool
    {
        return (float) $this->valor_neto <= 0.01;
    }
}
