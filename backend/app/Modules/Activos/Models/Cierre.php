<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Cierre mensual de valuación.
 *
 * ABIERTO → CALCULADO → CERRADO
 *
 * Mientras está CALCULADO se puede recalcular cuantas veces haga falta: se
 * borran las filas de valuación de ese cierre y se rehacen. Una vez CERRADO
 * no se toca nada, y el período siguiente parte de sus valores finales.
 *
 * Esa separación entre calcular y cerrar es deliberada: el contador necesita
 * ver el resultado antes de darlo por bueno, y recalcular no debería dejar
 * reversos sucios en la contabilidad.
 */
class Cierre extends ActivoModel
{
    protected $table = 'activos.cierre';

    public $timestamps = false;

    protected $fillable = [
        'periodo', 'ufv_inicial', 'ufv_final', 'estado',
        'activos_procesados', 'total_actualizacion', 'total_dep_financiera',
        'total_dep_fiscal', 'total_no_deducible', 'comprobante_contable',
        'calculado_por', 'calculado_at', 'cerrado_por', 'cerrado_at',
    ];

    protected $casts = [
        'periodo'              => 'date',
        'ufv_inicial'          => 'decimal:5',
        'ufv_final'            => 'decimal:5',
        'calculado_at'         => 'datetime',
        'cerrado_at'           => 'datetime',
        'total_actualizacion'  => 'decimal:2',
        'total_dep_financiera' => 'decimal:2',
        'total_dep_fiscal'     => 'decimal:2',
        'total_no_deducible'   => 'decimal:2',
    ];

    public const ABIERTO   = 'ABIERTO';
    public const CALCULADO = 'CALCULADO';
    public const CERRADO   = 'CERRADO';
    public const ANULADO   = 'ANULADO';

    public function valuaciones(): HasMany
    {
        return $this->hasMany(Valuacion::class, 'cierre_id');
    }

    public function scopeCerrados($query)
    {
        return $query->where('estado', self::CERRADO);
    }

    public function estaCerrado(): bool  { return $this->estado === self::CERRADO; }
    public function estaAbierto(): bool  { return $this->estado === self::ABIERTO; }
    public function estaCalculado(): bool { return $this->estado === self::CALCULADO; }

    /** Solo se recalcula lo calculado; lo cerrado es definitivo. */
    public function puedeRecalcularse(): bool
    {
        return $this->estaAbierto() || $this->estaCalculado();
    }

    /**
     * Factor de actualización del período.
     *
     * La columna `factor` de la base es generada, pero acá se recalcula para
     * no depender de que esté materializada al momento de leerla.
     */
    public function factor(): float
    {
        if (! $this->ufv_inicial || (float) $this->ufv_inicial == 0.0) {
            return 1.0;
        }

        return (float) $this->ufv_final / (float) $this->ufv_inicial;
    }

    public function getVariacionPorcentualAttribute(): float
    {
        return round(($this->factor() - 1) * 100, 4);
    }

    public function getPeriodoAnteriorAttribute(): Carbon
    {
        return $this->periodo->copy()->subMonth()->startOfMonth();
    }

    public function getEtiquetaAttribute(): string
    {
        return $this->periodo->locale('es')->isoFormat('MMMM [de] YYYY');
    }
}
