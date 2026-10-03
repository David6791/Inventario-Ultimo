<?php

namespace App\Modules\Activos\Models;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/**
 * Parámetro con vigencia. Nunca se edita un parámetro pasado: se cierra la
 * vigencia anterior y se abre una nueva, para que un cierre de 2026 se pueda
 * reconstruir con el umbral que regía en 2026.
 */
class Parametro extends ActivoModel
{
    protected $table = 'activos.parametro';

    public const UMBRAL_UFV       = 'UMBRAL_CAPITALIZACION_UFV';
    public const DIAS_ALTA        = 'DIAS_HABILES_ALTA';
    public const DIAS_OCIOSO      = 'DIAS_PARA_OCIOSO';
    public const DIAS_POLIZA      = 'DIAS_ALERTA_POLIZA';
    public const DS5563_ADOPTADO  = 'REGIMEN_DS5563_ADOPTADO';
    public const PREFIJO_CODIGO   = 'PREFIJO_CODIGO';
    public const SIGLA_EMPRESA    = 'SIGLA_EMPRESA';

    protected $fillable = [
        'clave', 'valor', 'tipo_dato', 'descripcion',
        'vigente_desde', 'vigente_hasta',
    ];

    protected $casts = [
        'vigente_desde' => 'date',
        'vigente_hasta' => 'date',
        'created_at'    => 'datetime',
        'updated_at'    => 'datetime',
    ];

    public function scopeVigenteA($query, CarbonInterface|string|null $fecha = null)
    {
        $fecha = $fecha ? Carbon::parse($fecha) : Carbon::today();

        return $query->where('vigente_desde', '<=', $fecha)
            ->where(fn ($q) => $q->whereNull('vigente_hasta')
                                 ->orWhere('vigente_hasta', '>', $fecha));
    }

    /** Devuelve el valor con el tipo correcto según tipo_dato. */
    public function getCastedAttribute(): mixed
    {
        return match ($this->tipo_dato) {
            'numero'   => (float) $this->valor,
            'booleano' => filter_var($this->valor, FILTER_VALIDATE_BOOLEAN),
            'fecha'    => Carbon::parse($this->valor),
            default    => $this->valor,
        };
    }
}
