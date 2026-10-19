<?php

namespace App\Modules\Cargas\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

/** Concepto de retención (CNS, aporte a la cooperativa, COMIBOL…), general o por cooperativa. */
class RetencionConcepto extends CargasModel
{
    protected $table = 'cargas.retencion_concepto';

    protected $fillable = ['codigo', 'nombre', 'base_calculo', 'por_cooperativa', 'norma', 'activo'];

    protected $casts = ['por_cooperativa' => 'boolean', 'activo' => 'boolean'];

    public function tasas(): HasMany
    {
        return $this->hasMany(RetencionTasa::class, 'concepto_id')->orderByDesc('vigente_desde');
    }
}
