<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Una capa de costo. Cada ingreso crea una; las salidas las consumen por
 * antigüedad. Es la verdad del costeo PEPS.
 */
class CapaExistencia extends Model
{
    protected $table = 'capas_existencia';

    protected $fillable = [
        'producto_id', 'almacen_id', 'ingreso_detalle_id', 'fecha',
        'cantidad_inicial', 'cantidad_restante', 'costo_unitario',
        'lote', 'fecha_vencimiento',
    ];

    protected function casts(): array
    {
        return [
            'fecha'             => 'datetime',
            'fecha_vencimiento' => 'date',
            'cantidad_inicial'  => 'decimal:4',
            'cantidad_restante' => 'decimal:4',
            'costo_unitario'    => 'decimal:4',
        ];
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }

    public function consumos(): HasMany
    {
        return $this->hasMany(ConsumoCapa::class, 'capa_id');
    }

    /** Capas con saldo, de la más antigua a la más nueva. Es el orden PEPS. */
    public function scopeDisponibles(Builder $query, int $productoId, int $almacenId): Builder
    {
        return $query
            ->where('producto_id', $productoId)
            ->where('almacen_id', $almacenId)
            ->where('cantidad_restante', '>', 0)
            ->orderBy('fecha')
            ->orderBy('id');
    }

    public function estaAgotada(): bool
    {
        return (float) $this->cantidad_restante <= 0;
    }

    /** ¿Alguien ya consumió de esta capa? Bloquea anular el ingreso. */
    public function fueConsumida(): bool
    {
        return (float) $this->cantidad_restante < (float) $this->cantidad_inicial;
    }
}
