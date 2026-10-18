<?php

namespace App\Modules\Caja\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Saldo de una moneda en la sesión. El saldo inicial lo fija la base con lo
 * contado en el cierre anterior; solo la primera sesión de la caja lo digita.
 */
class SesionSaldo extends CajaModel
{
    protected $table = 'caja.sesion_saldo';

    public $timestamps = false;

    protected $fillable = ['sesion_id', 'moneda', 'saldo_inicial'];

    protected $casts = [
        'saldo_inicial'  => 'decimal:2',
        'saldo_esperado' => 'decimal:2',
        'saldo_contado'  => 'decimal:2',
        'diferencia'     => 'decimal:2',
    ];

    public function sesion(): BelongsTo
    {
        return $this->belongsTo(Sesion::class, 'sesion_id');
    }
}
