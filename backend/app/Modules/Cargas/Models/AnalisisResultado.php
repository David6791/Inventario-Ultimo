<?php

namespace App\Modules\Cargas\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnalisisResultado extends CargasModel
{
    protected $table = 'cargas.analisis_resultado';

    public $timestamps = false;

    protected $fillable = ['analisis_id', 'elemento_id', 'valor'];

    protected $casts = ['analisis_id' => 'integer', 'elemento_id' => 'integer', 'valor' => 'decimal:4'];

    public function elemento(): BelongsTo { return $this->belongsTo(Elemento::class, 'elemento_id'); }
}
