<?php

namespace App\Modules\Cargas\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Corrección del peso del cliente de un pesaje (la escribe cargas.corregir_peso_cliente). */
class PesajeClienteCorreccion extends CargasModel
{
    protected $table = 'cargas.pesaje_cliente_correccion';

    public $timestamps = false;

    protected $casts = ['pesaje_id' => 'integer', 'corregido_en' => 'datetime'];

    public function corregidoPor(): BelongsTo { return $this->belongsTo(User::class, 'corregido_por'); }
}
