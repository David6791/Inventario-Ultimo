<?php

namespace App\Models;

use App\Enums\EstadoTransferencia;
use App\Models\Scopes\TransferenciaAlmacenScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Transferencia extends Model
{
    protected $table = 'transferencias';

    public const PREFIJO = 'TR';
    public const TIPO_CONTADOR = 'transferencia';
    public const TIPO_DOCUMENTO = 'transferencia';

    protected $fillable = [
        'numero', 'almacen_origen_id', 'almacen_destino_id', 'fecha',
        'motivo', 'transportista', 'estado', 'registrado_por',

        'despachada_en', 'despachada_por',
        'recibida_en', 'recibida_por', 'observacion_recepcion',
        'motivo_anulacion', 'anulada_en', 'anulada_por',
    ];

    protected function casts(): array
    {
        return [
            'estado'        => EstadoTransferencia::class,
            'fecha'         => 'date',
            'despachada_en' => 'datetime',
            'recibida_en'   => 'datetime',
            'anulada_en'    => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope(new TransferenciaAlmacenScope);
    }

    public function detalles(): HasMany
    {
        return $this->hasMany(TransferenciaDetalle::class);
    }

    public function origen(): BelongsTo
    {
        return $this->belongsTo(Almacen::class, 'almacen_origen_id');
    }

    public function destino(): BelongsTo
    {
        return $this->belongsTo(Almacen::class, 'almacen_destino_id');
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    public function despachadaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'despachada_por');
    }

    public function recibidaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recibida_por');
    }

    /** En tránsito: salió del origen y todavía no llegó. */
    public function scopeEnTransito(Builder $query): Builder
    {
        return $query->where('estado', EstadoTransferencia::Despachada->value);
    }

    /** Valor del material trasladado, a costo de las capas que viajaron. */
    public function valorTotal(): float
    {
        return (float) $this->detalles->sum(
            fn ($d) => $d->capas->sum(fn ($c) => (float) $c->cantidad * (float) $c->costo_unitario)
        );
    }

    /** ¿Llegó menos de lo que salió? Queda documentado en la recepción. */
    public function tieneFaltantes(): bool
    {
        return $this->detalles->contains(
            fn ($d) => $d->cantidad_recibida !== null
                && (float) $d->cantidad_recibida < (float) $d->cantidad
        );
    }
}
