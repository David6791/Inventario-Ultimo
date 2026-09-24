<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DevolucionDetalle extends Model
{
    protected $table = 'devoluciones_detalle';

    protected $fillable = [
        'devolucion_id', 'salida_detalle_id', 'producto_id',
        'producto_codigo', 'producto_nombre', 'unidad_medida',
        'cantidad', 'costo_total', 'estado_bien', 'observaciones',
    ];

    protected function casts(): array
    {
        return [
            'cantidad'    => 'decimal:4',
            'costo_total' => 'decimal:2',
        ];
    }

    public function devolucion(): BelongsTo
    {
        return $this->belongsTo(Devolucion::class, 'devolucion_id');
    }

    public function salidaDetalle(): BelongsTo
    {
        return $this->belongsTo(SalidaDetalle::class, 'salida_detalle_id');
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }

    public function consumos(): HasMany
    {
        return $this->hasMany(DevolucionConsumo::class, 'devolucion_detalle_id');
    }

    public function costoUnitarioPromedio(): float
    {
        return (float) $this->cantidad > 0
            ? round((float) $this->costo_total / (float) $this->cantidad, 4)
            : 0.0;
    }
}
