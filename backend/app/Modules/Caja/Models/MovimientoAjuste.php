<?php

namespace App\Modules\Caja\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ajuste del monto de un comprobante provisional, dentro del día.
 *
 *   baja, o sube en caja sin aprobación → APLICADO al momento
 *   sube en caja con aprobación         → PENDIENTE → APROBADO → APLICADO
 *                                                    ↘ RECHAZADO
 *
 * Lo escriben solo las funciones de la base (caja.ajustar_movimiento,
 * caja.resolver_ajuste, caja.aplicar_ajuste).
 */
class MovimientoAjuste extends CajaModel
{
    protected $table = 'caja.movimiento_ajuste';

    public $timestamps = false;

    protected $guarded = ['*'];

    protected $casts = [
        'movimiento_id'  => 'integer',
        'monto_anterior' => 'decimal:2',
        'monto_nuevo'    => 'decimal:2',
        'registrado_en'  => 'datetime',
        'resuelto_en'    => 'datetime',
        'aplicado_en'    => 'datetime',
    ];

    public const PENDIENTE = 'PENDIENTE';
    public const APROBADO = 'APROBADO';

    public function movimiento(): BelongsTo
    {
        return $this->belongsTo(Movimiento::class, 'movimiento_id');
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    public function resueltoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resuelto_por');
    }

    public function aplicadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'aplicado_por');
    }
}
