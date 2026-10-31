<?php

namespace App\Modules\Cargas\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Monto de un bono con vigencia: tramo de peso, cantidad de elementos o monto único. */
class TipoBonoTramo extends CargasModel
{
    protected $table = 'cargas.tipo_bono_tramo';

    protected $casts = [
        'tipo_bono_id'  => 'integer',
        'desde'         => 'decimal:2',
        'hasta'         => 'decimal:2',
        'monto'         => 'decimal:2',
        'vigente_desde' => 'date',
        'vigente_hasta' => 'date',
    ];

    public function tipo(): BelongsTo { return $this->belongsTo(TipoBono::class, 'tipo_bono_id'); }
}
