<?php

namespace App\Modules\Caja\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Dinero que la caja de la sede central envía a otra caja. Queda EN_TRANSITO
 * hasta que el cajero de destino lo recibe (RECIBIDO) o quien lo envió lo
 * anula (ANULADO: el dinero vuelve a la central).
 */
class EnvioFondos extends CajaModel
{
    protected $table = 'caja.envio_fondos';

    protected $fillable = ['caja_origen_id', 'caja_destino_id', 'monto', 'moneda', 'motivo', 'entregado_a',
                           'movimiento_envio_id', 'enviado_por'];

    protected $casts = [
        'caja_origen_id'  => 'integer',
        'caja_destino_id' => 'integer',
        'monto'           => 'decimal:2',
        'enviado_en'      => 'datetime',
        'recibido_en'     => 'datetime',
        'anulado_en'      => 'datetime',
    ];

    public const EN_TRANSITO = 'EN_TRANSITO';

    public function origen(): BelongsTo { return $this->belongsTo(Caja::class, 'caja_origen_id'); }
    public function destino(): BelongsTo { return $this->belongsTo(Caja::class, 'caja_destino_id'); }
    public function movimientoEnvio(): BelongsTo { return $this->belongsTo(Movimiento::class, 'movimiento_envio_id'); }
    public function movimientoRecepcion(): BelongsTo { return $this->belongsTo(Movimiento::class, 'movimiento_recepcion_id'); }
    public function movimientoReintegro(): BelongsTo { return $this->belongsTo(Movimiento::class, 'movimiento_reintegro_id'); }
    public function enviadoPor(): BelongsTo { return $this->belongsTo(User::class, 'enviado_por'); }
    public function recibidoPor(): BelongsTo { return $this->belongsTo(User::class, 'recibido_por'); }
    public function anuladoPor(): BelongsTo { return $this->belongsTo(User::class, 'anulado_por'); }
}
