<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TransferenciaDetalle extends Model
{
    protected $table = 'transferencia_detalles';

    protected $fillable = [
        'transferencia_id', 'producto_id', 'cantidad',
        'cantidad_recibida', 'observacion',
    ];

    protected function casts(): array
    {
        return [
            'cantidad'          => 'decimal:4',
            'cantidad_recibida' => 'decimal:4',
        ];
    }

    public function transferencia(): BelongsTo
    {
        return $this->belongsTo(Transferencia::class);
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }

    /** Las capas de costo que viajan con esta línea. */
    public function capas(): HasMany
    {
        return $this->hasMany(TransferenciaCapa::class, 'transferencia_detalle_id');
    }

    public function faltante(): float
    {
        if ($this->cantidad_recibida === null) {
            return 0;
        }

        return max(0, (float) $this->cantidad - (float) $this->cantidad_recibida);
    }
}
