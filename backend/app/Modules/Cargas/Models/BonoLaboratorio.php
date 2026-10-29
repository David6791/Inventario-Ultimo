<?php

namespace App\Modules\Cargas\Models;

use App\Models\User;
use App\Modules\Caja\Models\Movimiento;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Bono de laboratorio de un lote de compra: el monto sale de la tabla según
 * los elementos del material. Se paga por caja al productor o a quien venga a
 * cobrar (queda su nombre). Es un anticipo: la liquidación lo descuenta.
 */
class BonoLaboratorio extends CargasModel
{
    protected $table = 'cargas.bono_laboratorio';

    protected $casts = [
        'lote_id'            => 'integer',
        'tramo_id'           => 'integer',
        'num_elementos'      => 'integer',
        'movimiento_caja_id' => 'integer',
        'monto'              => 'decimal:2',
        'anulado_en'         => 'datetime',
    ];

    public const PENDIENTE = 'PENDIENTE';
    public const PAGADO = 'PAGADO';

    public function lote(): BelongsTo { return $this->belongsTo(Lote::class, 'lote_id'); }
    public function movimiento(): BelongsTo { return $this->belongsTo(Movimiento::class, 'movimiento_caja_id'); }
    public function registradoPor(): BelongsTo { return $this->belongsTo(User::class, 'registrado_por'); }
}
