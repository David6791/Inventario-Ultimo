<?php

namespace App\Modules\Cargas\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Ley final del lote por elemento. El valor lo calcula la base según el criterio (salvo ACUERDO). */
class LoteLey extends CargasModel
{
    protected $table = 'cargas.lote_ley';

    public $timestamps = false;

    protected $fillable = ['lote_id', 'elemento_id', 'valor', 'criterio', 'observacion', 'determinado_por'];

    protected $casts = [
        'lote_id'               => 'integer',
        'elemento_id'           => 'integer',
        'analisis_dirimente_id' => 'integer',
        'valor'                 => 'decimal:4',
        'determinado_en'        => 'datetime',
    ];

    public const CRITERIOS = ['PROMEDIO', 'EMPRESA', 'DIRIMENTE', 'ACUERDO'];

    public function elemento(): BelongsTo { return $this->belongsTo(Elemento::class, 'elemento_id'); }
    public function determinadoPor(): BelongsTo { return $this->belongsTo(User::class, 'determinado_por'); }
}
