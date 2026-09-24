<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Qué capa consumió una línea de salida, y a qué precio.
 *
 * Sin este registro no se puede anular una salida sin descuadrar el costeo, ni
 * explicar cómo se valorizó un movimiento.
 */
class ConsumoCapa extends Model
{
    protected $table = 'consumos_capa';

    protected $fillable = ['salida_detalle_id', 'capa_id', 'cantidad', 'costo_unitario'];

    protected function casts(): array
    {
        return [
            'cantidad'       => 'decimal:4',
            'costo_unitario' => 'decimal:4',
        ];
    }

    public function capa(): BelongsTo
    {
        return $this->belongsTo(CapaExistencia::class, 'capa_id');
    }

    public function salidaDetalle(): BelongsTo
    {
        return $this->belongsTo(SalidaDetalle::class, 'salida_detalle_id');
    }

    public function importe(): float
    {
        return (float) $this->cantidad * (float) $this->costo_unitario;
    }
}
