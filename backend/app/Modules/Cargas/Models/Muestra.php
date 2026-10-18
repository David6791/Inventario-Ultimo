<?php

namespace App\Modules\Cargas\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Muestra del lote. El código (LOTE-M1, -M2…) y el tipo (PRINCIPAL/REMUESTREO) los pone la base. */
class Muestra extends CargasModel
{
    protected $table = 'cargas.muestra';

    protected $fillable = ['lote_id', 'fecha', 'metodo', 'peso_g', 'observaciones', 'registrado_por'];

    protected $casts = ['lote_id' => 'integer', 'fecha' => 'datetime', 'peso_g' => 'decimal:2'];

    public const METODOS = ['CUARTEO', 'CANALETA', 'PALA ALTERNA', 'TUBO', 'OTRO'];

    public function lote(): BelongsTo { return $this->belongsTo(Lote::class, 'lote_id'); }
    public function registradoPor(): BelongsTo { return $this->belongsTo(User::class, 'registrado_por'); }

    public function porciones(): HasMany
    {
        return $this->hasMany(MuestraPorcion::class, 'muestra_id')
            ->orderByRaw("array_position(array['EMPRESA','PRODUCTOR','TESTIGO']::varchar[], destino)");
    }

    public function analisis(): HasMany
    {
        return $this->hasMany(Analisis::class, 'muestra_id')
            ->orderByRaw("array_position(array['EMPRESA','PRODUCTOR','DIRIMENTE','ESTIMADO']::varchar[], tipo)")->orderBy('id');
    }
}
