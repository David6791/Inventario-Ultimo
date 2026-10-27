<?php

namespace App\Modules\Cargas\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Pesaje de báscula. El peso neto lo calcula la base. No se corrige: se anula
 * con motivo y se registra otro (y su bono pendiente se anula con él).
 */
class Pesaje extends CargasModel
{
    protected $table = 'cargas.pesaje';

    protected $fillable = [
        'lote_id', 'tipo', 'bascula', 'ticket', 'fecha', 'peso_bruto_kg', 'tara_kg', 'peso_cliente_kg', 'peso_cliente_tipo', 'num_sacos',
        'placa', 'chofer_nombre', 'chofer_ci', 'registrado_por', 'modalidad', 'descuento_sacos_kg', 'pesaje_viaje_id', 'numero_orden', 'fecha_ticket',
    ];

    protected $casts = [
        'lote_id'       => 'integer',
        'peso_bruto_kg' => 'decimal:2',
        'tara_kg'       => 'decimal:2',
        'peso_cliente_kg' => 'decimal:2',
        'peso_neto_kg'  => 'decimal:2',
        'descuento_sacos_kg' => 'decimal:2',
        'peso_final_kg' => 'decimal:2',
        'pesaje_viaje_id' => 'integer',
        'num_sacos'     => 'integer',
        'anulado'       => 'boolean',
        'fecha'         => 'datetime',
        'fecha_ticket'  => 'datetime',
    ];

    public const TIPOS = ['INGRESO', 'CONTROL'];
    public const MODALIDADES = ['BASCULA', 'SACOS'];

    public function lote(): BelongsTo { return $this->belongsTo(Lote::class, 'lote_id'); }
    public function registradoPor(): BelongsTo { return $this->belongsTo(User::class, 'registrado_por'); }

    /** Correcciones del peso declarado por el cliente (informativo), con motivo. */
    public function correccionesCliente(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PesajeClienteCorreccion::class, 'pesaje_id')->orderBy('id');
    }

    public function bono(): HasOne
    {
        return $this->hasOne(BonoTransporte::class, 'pesaje_id');
    }

    /** Fotos de los tickets (interior y exterior). */
    public function fotos(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(RecepcionFoto::class, 'pesaje_id')->orderBy('id');
    }

    /** Pesadas en la balanza manual (pesaje de SACOS). */
    public function sacos(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PesajeSaco::class, 'pesaje_id')->orderBy('orden');
    }

    /** Recepción mixta: el pesaje de báscula del camión en que vinieron estos sacos. */
    public function viaje(): BelongsTo
    {
        return $this->belongsTo(self::class, 'pesaje_viaje_id');
    }
}
