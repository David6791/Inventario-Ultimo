<?php

namespace App\Models;

use App\Enums\EstadoSolicitud;
use App\Models\Concerns\EsSolicitud;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Pide material que ENTRARÁ al almacén. Genera una nota de ingreso. */
class SolicitudCompra extends Model
{
    use EsSolicitud;

    protected $table = 'solicitudes_compra';

    /** Prefijo del correlativo y clave del contador. */
    public const PREFIJO = 'SC';
    public const TIPO_CONTADOR = 'solicitud-compra';

    /*
    | Incluye los campos de la aprobación. Sin ellos, Eloquent los descarta en
    | silencio: la solicitud quedaba aprobada pero sin documento ni firma
    | registrada, y la API respondía 200.
    */
    protected $fillable = [
        'numero', 'almacen_id', 'fecha',
        'unidad_solicitante', 'solicitante', 'justificacion',
        'partida_presupuestaria', 'monto_estimado',
        'estado', 'observaciones', 'registrado_por',

        'documento_ruta', 'documento_nombre',
        'fecha_aprobacion', 'observacion_aprobacion', 'aprobado_por',
    ];

    protected function casts(): array
    {
        return [
            'estado'           => EstadoSolicitud::class,
            'fecha'            => 'date',
            'fecha_aprobacion' => 'date',
            'monto_estimado'   => 'decimal:2',
        ];
    }

    public function detalles(): HasMany
    {
        return $this->hasMany(SolicitudCompraDetalle::class);
    }
}
