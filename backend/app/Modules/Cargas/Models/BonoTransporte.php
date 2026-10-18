<?php

namespace App\Modules\Cargas\Models;

use App\Models\User;
use App\Modules\Caja\Models\Movimiento;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Bono de transporte de un pesaje de ingreso. El monto sale del tramo vigente
 * (no se digita). Se paga con un egreso de caja de concepto BONO_TRANSPORTE,
 * vinculado en la misma transacción.
 */
class BonoTransporte extends CargasModel
{
    protected $table = 'cargas.bono_transporte';

    protected $fillable = ['pesaje_id', 'tramo_id', 'beneficiario_nombre', 'beneficiario_ci', 'monto', 'registrado_por'];

    protected $casts = [
        'pesaje_id'          => 'integer',
        'tramo_id'           => 'integer',
        'movimiento_caja_id' => 'integer',
        'monto'              => 'decimal:2',
        'anulado_en'         => 'datetime',
    ];

    public const PENDIENTE = 'PENDIENTE';
    public const PAGADO = 'PAGADO';
    public const ANULADO = 'ANULADO';

    public function pesaje(): BelongsTo { return $this->belongsTo(Pesaje::class, 'pesaje_id'); }
    public function tramo(): BelongsTo { return $this->belongsTo(BonoTramo::class, 'tramo_id'); }
    public function movimiento(): BelongsTo { return $this->belongsTo(Movimiento::class, 'movimiento_caja_id'); }
    public function registradoPor(): BelongsTo { return $this->belongsTo(User::class, 'registrado_por'); }
}
