<?php

namespace App\Modules\Cargas\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LineaProductoElemento extends CargasModel
{
    protected $table = 'cargas.linea_producto_elemento';

    public $timestamps = false;

    protected $fillable = ['linea_producto_id', 'elemento_id', 'rol', 'split_limit'];

    protected $casts = [
        'linea_producto_id' => 'integer',
        'elemento_id'       => 'integer',
        'split_limit'       => 'float',
    ];

    public const ROLES = ['PAGABLE', 'PENALIZABLE', 'INFORMATIVO'];

    public function elemento(): BelongsTo
    {
        return $this->belongsTo(Elemento::class, 'elemento_id');
    }
}
