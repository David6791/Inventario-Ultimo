<?php

namespace App\Models\Concerns;

use App\Enums\EstadoSolicitud;
use App\Models\Almacen;
use App\Models\Scopes\AlmacenScope;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Comportamiento común a las solicitudes de compra y de material.
 *
 * Las tablas están separadas a propósito — así la clave foránea de un ingreso
 * solo puede apuntar a una compra, y la de una salida solo a un material — pero
 * la máquina de estados, el alcance por almacén y el cálculo de saldos son
 * idénticos. Compartir el comportamiento en un trait evita que dentro de tres
 * meses uno tenga un arreglo que el otro no.
 *
 * El modelo que lo use debe definir:
 *   public function detalles(): HasMany
 */
trait EsSolicitud
{
    /** Cada usuario ve solo las solicitudes de sus almacenes. */
    protected static function bootEsSolicitud(): void
    {
        static::addGlobalScope(new AlmacenScope);
    }

    public function almacen(): BelongsTo
    {
        return $this->belongsTo(Almacen::class);
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    public function aprobadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'aprobado_por');
    }

    public function scopePendientes(Builder $query): Builder
    {
        return $query->whereIn('estado', [
            EstadoSolicitud::Aprobada->value,
            EstadoSolicitud::AtendidaParcial->value,
        ]);
    }

    /**
     * Recalcula el estado según lo atendido en el detalle.
     *
     * Se llama después de confirmar el movimiento que la atiende. Vive acá y no
     * en el controlador para que haya un solo lugar donde el estado cambie.
     */
    public function recalcularEstado(): void
    {
        if (in_array($this->estado, [
            EstadoSolicitud::Borrador,
            EstadoSolicitud::Rechazada,
            EstadoSolicitud::Anulada,
        ], true)) {
            return;
        }

        $lineas = $this->detalles()->get();

        $completas = $lineas->every(fn ($d) => (float) $d->cantidad_atendida >= (float) $d->cantidad);
        $alguna    = $lineas->contains(fn ($d) => (float) $d->cantidad_atendida > 0);

        $this->estado = match (true) {
            $completas => EstadoSolicitud::Atendida,
            $alguna    => EstadoSolicitud::AtendidaParcial,
            default    => EstadoSolicitud::Aprobada,
        };

        $this->save();
    }

    /** ¿Ya generó movimientos? Bloquea la anulación. */
    public function tieneMovimientos(): bool
    {
        return $this->detalles()->where('cantidad_atendida', '>', 0)->exists();
    }
}
