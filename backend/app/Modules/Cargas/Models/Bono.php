<?php

namespace App\Modules\Cargas\Models;

use App\Models\User;
use App\Modules\Caja\Models\Movimiento;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Bono de un lote (o de su pesaje de báscula) según el catálogo. El monto lo
 * fija la base con la tabla vigente, salvo los de monto manual. Se paga con
 * un egreso de la caja del acopio, vinculado en la misma transacción.
 */
class Bono extends CargasModel
{
    protected $table = 'cargas.bono';

    protected $fillable = ['tipo_bono_id', 'lote_id', 'pesaje_id', 'monto', 'moneda', 'naturaleza',
                           'beneficiario_nombre', 'beneficiario_ci', 'observacion', 'registrado_por'];

    protected $casts = [
        'tipo_bono_id'       => 'integer',
        'lote_id'            => 'integer',
        'pesaje_id'          => 'integer',
        'tramo_id'           => 'integer',
        'movimiento_caja_id' => 'integer',
        'base'               => 'decimal:2',
        'monto'              => 'decimal:2',
        'anulado_en'         => 'datetime',
    ];

    public const PENDIENTE = 'PENDIENTE';
    public const PAGADO = 'PAGADO';
    public const ANULADO = 'ANULADO';

    public function tipo(): BelongsTo { return $this->belongsTo(TipoBono::class, 'tipo_bono_id'); }
    public function lote(): BelongsTo { return $this->belongsTo(Lote::class, 'lote_id'); }
    public function pesaje(): BelongsTo { return $this->belongsTo(Pesaje::class, 'pesaje_id'); }
    public function tramo(): BelongsTo { return $this->belongsTo(TipoBonoTramo::class, 'tramo_id'); }
    public function movimiento(): BelongsTo { return $this->belongsTo(Movimiento::class, 'movimiento_caja_id'); }
    public function registradoPor(): BelongsTo { return $this->belongsTo(User::class, 'registrado_por'); }
    public function anuladoPor(): BelongsTo { return $this->belongsTo(User::class, 'anulado_por'); }

    /** «Bs 1.234,50» para los mensajes. */
    public function montoTexto(): string
    {
        return ($this->moneda === 'USD' ? '$us ' : 'Bs ') . number_format((float) $this->monto, 2, ',', '.');
    }
}
