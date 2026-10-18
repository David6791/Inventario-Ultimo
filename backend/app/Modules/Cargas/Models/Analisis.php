<?php

namespace App\Modules\Cargas\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Análisis de laboratorio de una muestra. No se corrige: se anula y se registra otro. */
class Analisis extends CargasModel
{
    protected $table = 'cargas.analisis';

    protected $fillable = ['muestra_id', 'laboratorio_id', 'tipo', 'numero_certificado', 'fecha_emision', 'registrado_por'];

    protected $casts = [
        'muestra_id'     => 'integer',
        'laboratorio_id' => 'integer',
        'fecha_emision'  => 'date:Y-m-d',
        'anulado'        => 'boolean',
    ];

    /** La ruta del archivo no sale en la API: el certificado se descarga por su endpoint. */
    protected $hidden = ['archivo_path'];

    protected $appends = ['con_certificado'];

    public const TIPOS = ['EMPRESA', 'PRODUCTOR', 'DIRIMENTE'];

    public function muestra(): BelongsTo { return $this->belongsTo(Muestra::class, 'muestra_id'); }
    public function laboratorio(): BelongsTo { return $this->belongsTo(Laboratorio::class, 'laboratorio_id'); }
    public function registradoPor(): BelongsTo { return $this->belongsTo(User::class, 'registrado_por'); }
    public function resultados(): HasMany { return $this->hasMany(AnalisisResultado::class, 'analisis_id'); }

    public function getConCertificadoAttribute(): bool
    {
        return $this->archivo_path !== null;
    }
}
