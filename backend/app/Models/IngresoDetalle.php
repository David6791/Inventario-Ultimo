<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class IngresoDetalle extends Model
{
    protected $table = 'ingreso_detalles';

    protected $fillable = [
        'ingreso_id', 'producto_id', 'solicitud_compra_detalle_id',
        'cantidad', 'costo_unitario', 'lote', 'fecha_vencimiento', 'observacion',
    ];

    protected function casts(): array
    {
        return [
            'cantidad'          => 'decimal:4',
            'costo_unitario'    => 'decimal:4',
            'fecha_vencimiento' => 'date',
        ];
    }

    public function ingreso(): BelongsTo
    {
        return $this->belongsTo(Ingreso::class);
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }

    /** La línea de la solicitud contra la que se imputa. */
    public function lineaSolicitud(): BelongsTo
    {
        return $this->belongsTo(SolicitudCompraDetalle::class, 'solicitud_compra_detalle_id');
    }

    /** La capa de costo que creó este ingreso, si ya se confirmó. */
    public function capa(): HasOne
    {
        return $this->hasOne(CapaExistencia::class, 'ingreso_detalle_id');
    }

    public function importe(): float
    {
        return (float) $this->cantidad * (float) $this->costo_unitario;
    }
}
