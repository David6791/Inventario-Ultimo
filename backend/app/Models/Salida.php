<?php

namespace App\Models;

use App\Enums\EstadoDocumento;
use App\Models\Scopes\AlmacenScope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Salida extends Model
{
    protected $table = 'salidas';

    public const PREFIJO = 'NS';
    public const TIPO_CONTADOR = 'salida';
    public const TIPO_DOCUMENTO = 'salida';

    /*
    | Incluye los campos que escribe el propio sistema al confirmar, anular o
    | adjuntar el respaldo.
    |
    | Eloquent descarta EN SILENCIO cualquier campo que no esté acá: el update()
    | devuelve true, la API responde 200 y no se guardó nada. Es la clase de
    | error que no deja rastro en ningún log.
    */
    protected $fillable = [
        'numero', 'almacen_id', 'fecha',
        'unidad_solicitante_id', 'solicitante_id', 'recibido_por_id',
        'unidad_solicitante', 'solicitante', 'recibido_por',
        'centro_costo', 'destino', 'motivo',
        'estado', 'registrado_por',

        'respaldo_ruta', 'respaldo_nombre', 'respaldo_subido_en',
        'confirmada_en', 'confirmada_por',
        'motivo_anulacion', 'anulada_en', 'anulada_por',
    ];

    protected function casts(): array
    {
        return [
            'estado'             => EstadoDocumento::class,
            'fecha'              => 'date',
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
        return $this->hasMany(SalidaDetalle::class);
    }

    public function almacen(): BelongsTo
    {
        return $this->belongsTo(Almacen::class);
    }

    /*
    | Las relaciones sirven para agrupar en reportes. Para mostrar el documento
    | se usan las columnas de texto, que son la foto del momento en que se
    | firmó: si mañana renombran la unidad, la nota no debe cambiar.
    */
    public function unidadSolicitante(): BelongsTo
    {
        return $this->belongsTo(UnidadSolicitante::class, 'unidad_solicitante_id');
    }

    public function solicitanteRegistrado(): BelongsTo
    {
        return $this->belongsTo(Solicitante::class, 'solicitante_id');
    }

    public function recibidoPorRegistrado(): BelongsTo
    {
        return $this->belongsTo(Solicitante::class, 'recibido_por_id');
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    public function confirmadaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmada_por');
    }

    /**
     * Confirmadas que todavía no tienen el escaneo firmado.
     *
     * Es la lista que el almacenero revisa al final del día: el material ya
     * salió, falta digitalizar el papel. Sin esto los respaldos se pierden.
     */
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

    /** Valor total de la salida, a costo del momento de confirmarla. */
    public function valorTotal(): float
    {
        return (float) $this->detalles->sum(
            fn ($d) => (float) $d->cantidad * (float) $d->costo_unitario
        );
    }
}
