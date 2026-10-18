<?php

namespace App\Modules\Cargas\Models;

use App\Models\Almacen;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Lote: todo cuelga de él. El código, la línea, el origen, la cooperativa y el
 * municipio los pone la base al recibir (a partir de la serie, el productor y
 * la mina); el estado avanza RECIBIDO → MUESTREADO → ANALIZADO → LIQUIDADO.
 */
class Lote extends CargasModel
{
    protected $table = 'cargas.lote';

    protected $fillable = [
        'serie_id', 'almacen_id', 'fecha_recepcion', 'productor_id', 'mina_id', 'bocamina_id',
        'guia_transporte', 'material', 'observaciones', 'registrado_por',
    ];

    /** Elementos que trae el mineral, como en el sistema anterior. */
    public const MATERIALES = ['ZN', 'AG', 'PB', 'ZN-AG', 'PB-AG', 'ZN-PB', 'ZN-AG-PB'];

    protected $casts = [
        'serie_id'          => 'integer',
        'linea_producto_id' => 'integer',
        'almacen_id'        => 'integer',
        'productor_id'      => 'integer',
        'cooperativa_id'    => 'integer',
        'mina_id'           => 'integer',
        'bocamina_id'       => 'integer',
        'municipio_id'      => 'integer',
        'fecha_recepcion'   => 'datetime',
        'anulado_en'        => 'datetime',
    ];

    public const ESTADOS = ['RECIBIDO', 'MUESTREADO', 'ANALIZADO', 'LIQUIDADO', 'ANULADO'];

    public function serie(): BelongsTo { return $this->belongsTo(SerieLote::class, 'serie_id'); }
    public function linea(): BelongsTo { return $this->belongsTo(LineaProducto::class, 'linea_producto_id'); }
    public function almacen(): BelongsTo { return $this->belongsTo(Almacen::class, 'almacen_id'); }
    public function productor(): BelongsTo { return $this->belongsTo(Productor::class, 'productor_id'); }
    public function cooperativa(): BelongsTo { return $this->belongsTo(Cooperativa::class, 'cooperativa_id'); }
    public function mina(): BelongsTo { return $this->belongsTo(Mina::class, 'mina_id'); }
    public function bocamina(): BelongsTo { return $this->belongsTo(Bocamina::class, 'bocamina_id'); }
    public function municipio(): BelongsTo { return $this->belongsTo(Municipio::class, 'municipio_id'); }
    public function registradoPor(): BelongsTo { return $this->belongsTo(User::class, 'registrado_por'); }
    public function anuladoPor(): BelongsTo { return $this->belongsTo(User::class, 'anulado_por'); }

    public function pesajes(): HasMany
    {
        return $this->hasMany(Pesaje::class, 'lote_id')->orderBy('fecha')->orderBy('id');
    }

    public function eventos(): HasMany
    {
        return $this->hasMany(LoteEvento::class, 'lote_id')->orderBy('ocurrido_en')->orderBy('id');
    }

    /** Lotes de las sedes del usuario, salvo que vea todas. */
    public function scopeDelAmbitoDe(Builder $query, User $usuario): Builder
    {
        if ($usuario->can('cargas.ver-todos-almacenes') || $usuario->can('almacenes.ver-todos')) {
            return $query;
        }

        return $query->whereIn('almacen_id', $usuario->almacenesIds());
    }

    public function esDelAmbitoDe(User $usuario): bool
    {
        return $usuario->can('cargas.ver-todos-almacenes') || $usuario->accedeAlmacen($this->almacen_id);
    }
}
