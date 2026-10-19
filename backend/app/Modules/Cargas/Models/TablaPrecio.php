<?php

namespace App\Modules\Cargas\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Tabla de precios de una línea y un elemento, con vigencia. Nace en
 * BORRADOR, la aprueba otra persona y desde ahí no se edita: se reemplaza.
 */
class TablaPrecio extends CargasModel
{
    protected $table = 'cargas.tabla_precio';

    protected $fillable = ['linea_producto_id', 'elemento_id', 'modalidad', 'moneda', 'factor_conversion', 'descripcion',
                           'vigente_desde', 'creado_por'];

    protected $casts = [
        'linea_producto_id' => 'integer',
        'elemento_id'       => 'integer',
        'factor_conversion' => 'decimal:6',
        'vigente_desde'     => 'date:Y-m-d',
        'vigente_hasta'     => 'date:Y-m-d',
        'aprobado_en'       => 'datetime',
    ];

    public const MODALIDADES = ['POR_PUNTO', 'POR_PORCENTAJE'];

    public function linea(): BelongsTo { return $this->belongsTo(LineaProducto::class, 'linea_producto_id'); }
    public function elemento(): BelongsTo { return $this->belongsTo(Elemento::class, 'elemento_id'); }
    public function creadoPor(): BelongsTo { return $this->belongsTo(User::class, 'creado_por'); }
    public function aprobadoPor(): BelongsTo { return $this->belongsTo(User::class, 'aprobado_por'); }
    public function tramos(): HasMany { return $this->hasMany(TablaPrecioTramo::class, 'tabla_precio_id')->orderBy('ley_desde'); }
}
