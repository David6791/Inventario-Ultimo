<?php

namespace App\Modules\Cargas\Models;

use App\Modules\Caja\Models\Concepto;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Un bono del catálogo: cómo se calcula, quién cobra, si es anticipo (la
 * liquidación lo descuenta) o premio, y a qué lotes aplica. Al crearlo, la
 * base le da su propio concepto de caja.
 */
class TipoBono extends CargasModel
{
    protected $table = 'cargas.tipo_bono';

    protected $fillable = ['codigo', 'nombre', 'descripcion', 'calculo', 'naturaleza', 'cobra', 'permite_otro',
                           'aplica_a', 'serie_id', 'activo', 'orden'];

    protected $casts = [
        'permite_otro' => 'boolean',
        'sistema'      => 'boolean',
        'activo'       => 'boolean',
        'serie_id'     => 'integer',
        'concepto_id'  => 'integer',
        'orden'        => 'integer',
    ];

    public const CALCULOS = ['TRAMOS_PESO', 'POR_TONELADA', 'POR_ELEMENTOS', 'FIJO', 'MANUAL'];
    /** Nacen con el pesaje de báscula; los demás, con el lote. */
    public const POR_PESAJE = ['TRAMOS_PESO', 'POR_TONELADA'];

    public function tramos(): HasMany { return $this->hasMany(TipoBonoTramo::class, 'tipo_bono_id'); }
    public function serie(): BelongsTo { return $this->belongsTo(SerieLote::class, 'serie_id'); }
    public function concepto(): BelongsTo { return $this->belongsTo(Concepto::class, 'concepto_id'); }

    public function scopeActivos($q) { return $q->where('activo', true); }
}
