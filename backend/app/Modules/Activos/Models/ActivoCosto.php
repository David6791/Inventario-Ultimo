<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Desglose del costo de incorporación (Art. 21 del Reglamento).
 *
 * Se guarda el detalle y no solo el total porque en una auditoría la pregunta
 * no es cuánto costó, sino qué se capitalizó y con qué respaldo.
 */
class ActivoCosto extends ActivoModel
{
    protected $table = 'activos.activo_costo';

    protected $fillable = ['activo_id', 'concepto', 'monto', 'documento', 'observacion'];

    protected $casts = [
        'monto'      => 'decimal:2',
        'created_at' => 'datetime',
    ];

    public const CONCEPTOS = [
        'PRECIO', 'FLETE', 'SEGURO', 'TRIBUTOS_IMPORTACION',
        'DESADUANIZACION', 'INSTALACION', 'MONTAJE', 'PRUEBAS', 'OTRO',
    ];

    public function activo(): BelongsTo
    {
        return $this->belongsTo(Activo::class, 'activo_id');
    }
}
