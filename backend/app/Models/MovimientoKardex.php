<?php

namespace App\Models;

use App\Models\Scopes\AlmacenScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una línea del kardex. Nunca se actualiza ni se borra: una anulación escribe
 * un movimiento inverso.
 */
class MovimientoKardex extends Model
{
    protected $table = 'kardex';

    public $timestamps = true;

    protected $fillable = [
        'producto_id', 'almacen_id', 'fecha', 'tipo',
        'documento_tipo', 'documento_id', 'documento_numero',
        'entrada', 'salida', 'saldo',
        'costo_unitario', 'costo_total',
        'registrado_por', 'observacion',
    ];

    protected function casts(): array
    {
        return [
            'fecha'          => 'datetime',
            'entrada'        => 'decimal:4',
            'salida'         => 'decimal:4',
            'saldo'          => 'decimal:4',
            'costo_unitario' => 'decimal:4',
            'costo_total'    => 'decimal:4',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope(new AlmacenScope);
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }

    public function almacen(): BelongsTo
    {
        return $this->belongsTo(Almacen::class);
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }
}
