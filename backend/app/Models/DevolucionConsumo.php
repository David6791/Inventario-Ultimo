<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DevolucionConsumo extends Model
{
    protected $table = 'devoluciones_consumo';

    protected $fillable = [
        'devolucion_detalle_id', 'consumo_capa_id', 'capa_id',
        'cantidad', 'costo_unitario', 'costo_total',
    ];

    protected function casts(): array
    {
        return [
            'cantidad'       => 'decimal:4',
            'costo_unitario' => 'decimal:4',
            'costo_total'    => 'decimal:2',
        ];
    }

    public function detalle(): BelongsTo
    {
        return $this->belongsTo(DevolucionDetalle::class, 'devolucion_detalle_id');
    }

    public function consumoCapa(): BelongsTo
    {
        return $this->belongsTo(ConsumoCapa::class, 'consumo_capa_id');
    }

    public function capa(): BelongsTo
    {
        return $this->belongsTo(CapaExistencia::class, 'capa_id');
    }
}
