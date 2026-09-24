<?php

namespace App\Models;

use App\Enums\MotivoDevolucion;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Devolucion extends Model
{
    protected $table = 'devoluciones';

    protected $fillable = [
        'numero', 'gestion', 'fecha', 'salida_id', 'almacen_id',
        'solicitante_id', 'unidad_solicitante_id',
        'solicitante_nombre', 'unidad_nombre', 'salida_numero',
        'motivo', 'costo_total', 'cantidad_lineas',
        'estado', 'motivo_anulacion', 'observaciones',
        'pdf_path', 'nota_firmada', 'usuario_id',
    ];

    protected function casts(): array
    {
        return [
            'fecha'        => 'date',
            'costo_total'  => 'decimal:2',
            'nota_firmada' => 'boolean',
            'motivo'       => MotivoDevolucion::class,
        ];
    }

    public function detalles(): HasMany
    {
        return $this->hasMany(DevolucionDetalle::class, 'devolucion_id');
    }

    public function salida(): BelongsTo
    {
        return $this->belongsTo(Salida::class, 'salida_id');
    }

    public function solicitante(): BelongsTo
    {
        return $this->belongsTo(Solicitante::class, 'solicitante_id');
    }

    public function unidadSolicitante(): BelongsTo
    {
        return $this->belongsTo(UnidadSolicitante::class, 'unidad_solicitante_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id');
    }

    public function scopeRegistradas(Builder $consulta): Builder
    {
        return $consulta->where('estado', 'registrada');
    }

    public function estaRegistrada(): bool
    {
        return $this->estado === 'registrada';
    }
}
