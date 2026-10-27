<?php

namespace App\Modules\Cargas\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Una pesada en la balanza manual: un saco, una tanda o el total, con su foto. */
class PesajeSaco extends CargasModel
{
    protected $table = 'cargas.pesaje_saco';

    public const UPDATED_AT = null;

    protected $fillable = ['pesaje_id', 'orden', 'sacos', 'peso_kg'];

    protected $casts = [
        'pesaje_id' => 'integer',
        'orden'     => 'integer',
        'sacos'     => 'integer',
        'peso_kg'   => 'decimal:2',
    ];

    public function pesaje(): BelongsTo { return $this->belongsTo(Pesaje::class, 'pesaje_id'); }

    public function fotos(): HasMany
    {
        return $this->hasMany(RecepcionFoto::class, 'pesaje_saco_id')->orderBy('id');
    }
}
