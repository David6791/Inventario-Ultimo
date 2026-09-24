<?php

namespace App\Models;

use App\Enums\EstadoSolicitud;
use App\Models\Concerns\EsSolicitud;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Pide material que SALDRÁ del almacén. Genera una nota de salida. */
class SolicitudMaterial extends Model
{
    use EsSolicitud;

    protected $table = 'solicitudes_material';

    public const PREFIJO = 'SM';
    public const TIPO_CONTADOR = 'solicitud-material';

    protected $fillable = [
        'numero', 'almacen_id', 'fecha',
        'unidad_solicitante', 'solicitante', 'justificacion',
        'centro_costo', 'destino',
        'estado', 'observaciones', 'registrado_por',
    ];

    protected function casts(): array
    {
        return [
            'estado'           => EstadoSolicitud::class,
            'fecha'            => 'date',
            'fecha_aprobacion' => 'date',
        ];
    }

    public function detalles(): HasMany
    {
        return $this->hasMany(SolicitudMaterialDetalle::class);
    }
}
