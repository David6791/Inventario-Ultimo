<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Foto extends ActivoModel
{
    protected $table = 'activos.foto';

    public $timestamps = false;

    protected $fillable = [
        'activo_id', 'path', 'path_miniatura', 'tipo', 'descripcion',
        'es_principal', 'documento_id', 'tamanio_bytes', 'ancho', 'alto',
        'subido_por', 'created_at',
    ];

    protected $casts = [
        'es_principal' => 'boolean',
        'created_at'   => 'datetime',
    ];

    public const TIPOS = [
        'IDENTIFICACION' => 'Identificación',
        'ESTADO'         => 'Estado del bien',
        'SERIE'          => 'Serie o placa',
        'ENTREGA'        => 'Entrega al custodio',
        'DEVOLUCION'     => 'Devolución',
        'TOMA_FISICA'    => 'Toma física',
        'BAJA'           => 'Respaldo de baja',
    ];

    public function activo(): BelongsTo
    {
        return $this->belongsTo(Activo::class, 'activo_id');
    }

    public function scopePrincipales($query)
    {
        return $query->where('es_principal', true);
    }

    public function scopeDelTipo($query, string $tipo)
    {
        return $query->where('tipo', $tipo);
    }

    public function getUrlAttribute(): string
    {
        return Storage::disk('public')->url($this->path);
    }

    public function getUrlMiniaturaAttribute(): string
    {
        return $this->path_miniatura
            ? Storage::disk('public')->url($this->path_miniatura)
            : $this->url;
    }

    public function getEtiquetaTipoAttribute(): string
    {
        return self::TIPOS[$this->tipo] ?? $this->tipo;
    }
}
