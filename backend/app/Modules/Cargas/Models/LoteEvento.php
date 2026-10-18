<?php

namespace App\Modules\Cargas\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Bitácora de estados del lote (la escribe la base). */
class LoteEvento extends CargasModel
{
    protected $table = 'cargas.lote_evento';

    public $timestamps = false;

    protected $casts = ['ocurrido_en' => 'datetime'];

    public function usuario(): BelongsTo { return $this->belongsTo(User::class, 'usuario_id'); }
}
