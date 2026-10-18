<?php

namespace App\Modules\Cargas\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Lectura estimada de recepción (visual o analizador portátil). Referencial: no se paga con ella. */
class LecturaEstimada extends CargasModel
{
    protected $table = 'cargas.lote_lectura_estimada';

    public $timestamps = false;

    protected $fillable = ['lote_id', 'elemento_id', 'valor', 'metodo', 'registrado_por', 'registrado_en'];

    protected $casts = ['lote_id' => 'integer', 'elemento_id' => 'integer', 'valor' => 'decimal:4', 'registrado_en' => 'datetime'];

    public function elemento(): BelongsTo { return $this->belongsTo(Elemento::class, 'elemento_id'); }
}
