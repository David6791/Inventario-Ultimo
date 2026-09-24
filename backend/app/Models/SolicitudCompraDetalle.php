<?php

namespace App\Models;

use App\Models\Concerns\EsDetalleSolicitud;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SolicitudCompraDetalle extends Model
{
    use EsDetalleSolicitud;

    protected $table = 'solicitud_compra_detalles';

    protected $fillable = [
        'solicitud_compra_id', 'producto_id',
        'cantidad', 'cantidad_atendida', 'especificacion',
    ];

    protected function casts(): array
    {
        return [
            'cantidad'          => 'decimal:4',
            'cantidad_atendida' => 'decimal:4',
        ];
    }

    public function solicitud(): BelongsTo
    {
        return $this->belongsTo(SolicitudCompra::class, 'solicitud_compra_id');
    }
}
