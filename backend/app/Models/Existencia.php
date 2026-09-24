<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Existencia extends Model
{
    protected $table = 'existencias';

    protected $fillable = [
        'producto_id', 'almacen_id', 'cantidad',
        'costo_promedio', 'ubicacion_fisica', 'ultimo_movimiento_en',
    ];

    protected function casts(): array
    {
        return [
            'cantidad'             => 'decimal:4',
            'costo_promedio'       => 'decimal:4',
            'ultimo_movimiento_en' => 'datetime',
        ];
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }

    public function almacen(): BelongsTo
    {
        return $this->belongsTo(Almacen::class);
    }

    /**
     * Cuánto hay de un producto en un almacén. Cero si nunca tuvo movimiento.
     *
     * Es la consulta que valida las solicitudes de material: no se puede pedir
     * más de lo que existe.
     */
    public static function disponible(int $productoId, int $almacenId): float
    {
        return (float) static::query()
            ->where('producto_id', $productoId)
            ->where('almacen_id', $almacenId)
            ->value('cantidad') ?? 0;
    }

    /**
     * Saldos de varios productos en una consulta.
     * Evita el N+1 al validar un detalle con veinte líneas.
     *
     * @param  list<int>  $productoIds
     * @return array<int, float>  producto_id => cantidad
     */
    public static function disponibles(array $productoIds, int $almacenId): array
    {
        if (! $productoIds) {
            return [];
        }

        return static::query()
            ->whereIn('producto_id', $productoIds)
            ->where('almacen_id', $almacenId)
            ->pluck('cantidad', 'producto_id')
            ->map(fn ($c) => (float) $c)
            ->all();
    }
}
