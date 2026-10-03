<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Clase de activo, alineada al Anexo del Artículo 22 del DS 24051.
 * La vida útil fiscal se hereda desde aquí al dar de alta un bien.
 */
class Clase extends ActivoModel
{
    protected $table = 'activos.clase';

    protected $fillable = [
        'codigo', 'nombre', 'deprecia', 'vida_util_fiscal_meses',
        'coeficiente_fiscal', 'cuenta_activo', 'cuenta_dep_acumulada',
        'cuenta_gasto_dep', 'es_bien_control', 'activo',
    ];

    protected $casts = [
        'deprecia'               => 'boolean',
        'es_bien_control'        => 'boolean',
        'activo'                 => 'boolean',
        'vida_util_fiscal_meses' => 'integer',
        'coeficiente_fiscal'     => 'decimal:4',
    ];

    public function subclases(): HasMany
    {
        return $this->hasMany(Subclase::class, 'clase_id');
    }

    /** Vida útil fiscal aplicando el régimen acelerado del DS 5563. */
    public function vidaUtilFiscalMeses(bool $acelerado = false): ?int
    {
        if (! $this->deprecia || $this->vida_util_fiscal_meses === null) {
            return null;
        }

        return $acelerado
            ? (int) ceil($this->vida_util_fiscal_meses / 2)
            : $this->vida_util_fiscal_meses;
    }

    public function scopeActivas($query)
    {
        return $query->where('activo', true);
    }
}
