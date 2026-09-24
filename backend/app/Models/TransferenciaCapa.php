<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una capa de costo que viaja con el material.
 *
 * Al despachar se anota de qué capa del origen salió cada porción y a qué
 * precio. Al recibir, esas capas se replican en el destino con su precio
 * original — si no, una transferencia crearía o destruiría valor.
 */
class TransferenciaCapa extends Model
{
    protected $table = 'transferencia_capas';

    protected $fillable = [
        'transferencia_detalle_id', 'capa_origen_id',
        'cantidad', 'costo_unitario', 'lote', 'fecha_vencimiento',
    ];

    protected function casts(): array
    {
        return [
            'cantidad'          => 'decimal:4',
            'costo_unitario'    => 'decimal:4',
            'fecha_vencimiento' => 'date',
        ];
    }

    public function detalle(): BelongsTo
    {
        return $this->belongsTo(TransferenciaDetalle::class, 'transferencia_detalle_id');
    }

    public function capaOrigen(): BelongsTo
    {
        return $this->belongsTo(CapaExistencia::class, 'capa_origen_id');
    }

    public function importe(): float
    {
        return (float) $this->cantidad * (float) $this->costo_unitario;
    }
}
