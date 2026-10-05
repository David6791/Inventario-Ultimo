<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Mejora capitalizada sobre un activo (Art. 23 del Reglamento).
 *
 * Solo se capitaliza lo que extiende la vida útil, aumenta la capacidad,
 * mejora sustancialmente la calidad o reduce significativamente los costos.
 * Todo lo demás es gasto del período, y la base lo exige: `informe_tecnico`
 * es NOT NULL.
 */
class Mejora extends ActivoModel
{
    protected $table = 'activos.mejora';

    protected $fillable = [
        'activo_id', 'fecha', 'descripcion', 'monto', 'criterio',
        'meses_vida_adicional', 'informe_tecnico', 'aprobado_por',
        'aplicada_en_periodo',
    ];

    protected $casts = [
        'fecha'               => 'date',
        'aplicada_en_periodo' => 'date',
        'monto'               => 'decimal:2',
        'created_at'          => 'datetime',
    ];

    public const CRITERIOS = [
        'EXTIENDE_VIDA_UTIL', 'AUMENTA_CAPACIDAD',
        'MEJORA_CALIDAD', 'REDUCE_COSTOS',
    ];

    public function activo(): BelongsTo
    {
        return $this->belongsTo(Activo::class, 'activo_id');
    }
}
