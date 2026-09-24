<?php

namespace App\Models;

use App\Enums\EstadoDocumento;
use App\Models\Scopes\AlmacenScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Recepción de material. Siempre nace de una solicitud de compra aprobada. */
class Ingreso extends Model
{
    protected $table = 'ingresos';

    public const PREFIJO = 'NI';
    public const TIPO_CONTADOR = 'ingreso';
    public const TIPO_DOCUMENTO = 'ingreso';

    protected $fillable = [
        'numero', 'almacen_id', 'solicitud_compra_id', 'fecha',
        'proveedor', 'tipo_documento', 'numero_documento', 'fecha_documento',
        'estado', 'observaciones', 'registrado_por',

        // Los escribe el sistema. Sin declararlos acá, Eloquent los descarta
        // en silencio y el update devuelve true igual.
        'respaldo_ruta', 'respaldo_nombre', 'respaldo_subido_en',
        'confirmada_en', 'confirmada_por',
        'motivo_anulacion', 'anulada_en', 'anulada_por',
    ];

    protected function casts(): array
    {
        return [
            'estado'             => EstadoDocumento::class,
            'fecha'              => 'date',
            'fecha_documento'    => 'date',
            'confirmada_en'      => 'datetime',
            'anulada_en'         => 'datetime',
            'respaldo_subido_en' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::addGlobalScope(new AlmacenScope);
    }

    public function detalles(): HasMany
    {
        return $this->hasMany(IngresoDetalle::class);
    }

    public function almacen(): BelongsTo
    {
        return $this->belongsTo(Almacen::class);
    }

    public function solicitud(): BelongsTo
    {
        return $this->belongsTo(SolicitudCompra::class, 'solicitud_compra_id');
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    public function confirmadaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmada_por');
    }

    /** Confirmados que todavía no tienen la factura escaneada. */
    public function scopeSinRespaldo(Builder $query): Builder
    {
        return $query
            ->where('estado', EstadoDocumento::Confirmada->value)
            ->whereNull('respaldo_ruta');
    }

    public function tieneRespaldo(): bool
    {
        return $this->respaldo_ruta !== null;
    }

    public function valorTotal(): float
    {
        return (float) $this->detalles->sum(
            fn ($d) => (float) $d->cantidad * (float) $d->costo_unitario
        );
    }
}
