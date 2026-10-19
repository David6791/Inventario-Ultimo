<?php

namespace App\Modules\Cargas\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RetencionTasa extends CargasModel
{
    protected $table = 'cargas.retencion_tasa';

    protected $casts = [
        'concepto_id'    => 'integer',
        'cooperativa_id' => 'integer',
        'porcentaje'     => 'decimal:4',
        'vigente_desde'  => 'date:Y-m-d',
        'vigente_hasta'  => 'date:Y-m-d',
    ];

    public function cooperativa(): BelongsTo { return $this->belongsTo(Cooperativa::class, 'cooperativa_id'); }
    public function registradoPor(): BelongsTo { return $this->belongsTo(User::class, 'registrado_por'); }
}
