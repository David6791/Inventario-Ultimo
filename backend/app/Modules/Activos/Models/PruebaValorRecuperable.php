<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Prueba del límite de la NC 3.
 *
 * La actualización por UFV no puede llevar el valor del bien por encima de su
 * valor recuperable. Esta tabla deja constancia de la verificación: sin ella,
 * el ajuste sería mecánico y terminaría sobrevaluando el activo, inflando el
 * AITB y, con eso, la base del IUE.
 */
class PruebaValorRecuperable extends ActivoModel
{
    protected $table = 'activos.prueba_valor_recuperable';

    protected $fillable = [
        'activo_id', 'periodo', 'valor_actualizado_ufv', 'valor_recuperable',
        'valor_adoptado', 'metodo', 'respaldo', 'registrado_por',
    ];

    protected $casts = [
        'periodo'              => 'date',
        'valor_actualizado_ufv'=> 'decimal:2',
        'valor_recuperable'    => 'decimal:2',
        'valor_adoptado'       => 'decimal:2',
        'created_at'           => 'datetime',
    ];

    public const METODOS = [
        'VALOR_NETO_REALIZACION',
        'VALOR_UTILIZACION_ECONOMICA',
        'VALOR_MERCADO',
        'TASACION_PERICIAL',
    ];

    public function activo(): BelongsTo
    {
        return $this->belongsTo(Activo::class, 'activo_id');
    }

    /** Hubo recorte: el valor actualizado excedía el recuperable. */
    public function huboAjuste(): bool
    {
        return (float) $this->valor_adoptado < (float) $this->valor_actualizado_ufv;
    }
}
