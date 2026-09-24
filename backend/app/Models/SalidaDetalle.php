<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalidaDetalle extends Model
{
    protected $table = 'salida_detalles';

    protected $fillable = [
        'salida_id', 'producto_id', 'cantidad', 'costo_unitario', 'observacion',
    ];

    protected function casts(): array
    {
        return [
            'cantidad'       => 'decimal:4',
            'costo_unitario' => 'decimal:4',
        ];
    }

    public function salida(): BelongsTo
    {
        return $this->belongsTo(Salida::class);
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }
}
