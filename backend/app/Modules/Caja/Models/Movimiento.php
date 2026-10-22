<?php

namespace App\Modules\Caja\Models;

use App\Models\User;
use App\Modules\Comun\Models\Banco;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ingreso o egreso de caja. El número de comprobante, el tipo (lo define el
 * concepto) y la caja los pone la base. No se corrige: se anula con motivo
 * mientras la sesión está abierta y se registra otro.
 */
class Movimiento extends CajaModel
{
    protected $table = 'caja.movimiento';

    protected $fillable = [
        'sesion_id', 'concepto_id', 'monto', 'moneda', 'forma_pago', 'banco_id',
        'nro_documento', 'persona_id', 'persona_nombre', 'persona_ci', 'glosa', 'registrado_por', 'solicitud_id', 'provisional',
    ];

    protected $casts = [
        'sesion_id'   => 'integer',
        'caja_id'     => 'integer',
        'concepto_id' => 'integer',
        'banco_id'    => 'integer',
        'persona_id'  => 'integer',
        'solicitud_id' => 'integer',
        'monto'       => 'decimal:2',
        'fecha'       => 'datetime',
        'anulado_en'  => 'datetime',
        'provisional' => 'boolean',
        'validado_en' => 'datetime',
    ];

    public const MONEDAS = ['BOB', 'USD'];
    public const FORMAS_PAGO = ['EFECTIVO', 'CHEQUE', 'TRANSFERENCIA'];
    public const VIGENTE = 'VIGENTE';
    public const ANULADO = 'ANULADO';

    public function sesion(): BelongsTo
    {
        return $this->belongsTo(Sesion::class, 'sesion_id');
    }

    public function caja(): BelongsTo
    {
        return $this->belongsTo(Caja::class, 'caja_id');
    }

    public function concepto(): BelongsTo
    {
        return $this->belongsTo(Concepto::class, 'concepto_id');
    }

    public function banco(): BelongsTo
    {
        return $this->belongsTo(Banco::class, 'banco_id');
    }

    public function persona(): BelongsTo
    {
        return $this->belongsTo(Persona::class, 'persona_id');
    }

    public function solicitud(): BelongsTo
    {
        return $this->belongsTo(Solicitud::class, 'solicitud_id');
    }

    /** Ajustes del monto (solo comprobantes provisionales), del primero al último. */
    public function ajustes(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(MovimientoAjuste::class, 'movimiento_id')->orderBy('id');
    }

    public function validadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validado_por');
    }

    public function registradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    public function anuladoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'anulado_por');
    }
}
