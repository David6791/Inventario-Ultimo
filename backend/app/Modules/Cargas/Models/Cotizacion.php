<?php

namespace App\Modules\Cargas\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Cotización quincenal (OFICIAL del Ministerio, con alícuotas de regalía, o REFERENCIA interna). */
class Cotizacion extends CargasModel
{
    protected $table = 'cargas.cotizacion';

    protected $fillable = ['elemento_id', 'tipo', 'anio', 'mes', 'quincena', 'valor', 'unidad',
                           'alicuota_rm_exportacion', 'alicuota_rm_venta_interna', 'fuente', 'fecha_publicacion', 'registrado_por'];

    protected $casts = [
        'elemento_id'               => 'integer',
        'anio'                      => 'integer',
        'mes'                       => 'integer',
        'quincena'                  => 'integer',
        'valor'                     => 'decimal:4',
        'alicuota_rm_exportacion'   => 'decimal:4',
        'alicuota_rm_venta_interna' => 'decimal:4',
        'periodo_desde'             => 'date:Y-m-d',
        'periodo_hasta'             => 'date:Y-m-d',
        'fecha_publicacion'         => 'date:Y-m-d',
    ];

    public const TIPOS = ['OFICIAL', 'REFERENCIA'];
    public const UNIDADES = ['LF', 'OT', 'TMF', 'TM'];

    public function elemento(): BelongsTo { return $this->belongsTo(Elemento::class, 'elemento_id'); }
    public function registradoPor(): BelongsTo { return $this->belongsTo(User::class, 'registrado_por'); }
}
