<?php

namespace App\Modules\Activos\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Versión liviana para el listado: evita cargar costos y movimientos. */
class ActivoListaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'codigo'          => $this->codigo,
            'denominacion'    => $this->denominacion,
            'marca'           => $this->marca,
            'modelo'          => $this->modelo,
            'serie'           => $this->serie,
            'clase'           => $this->whenLoaded('clase', fn () => $this->clase->nombre),
            'subclase'        => $this->whenLoaded('subclase', fn () => $this->subclase->nombre),
            'ubicacion'       => $this->whenLoaded('ubicacion', fn () => $this->ubicacion->nombre),
            'estado'          => $this->estado,
            'condicion'       => $this->condicion,
            'custodio_id'     => $this->custodio_id,
            'es_bien_control' => $this->es_bien_control,
            'valor_origen'    => (float) $this->valor_origen,
            'fecha_incorporacion' => $this->fecha_incorporacion?->toDateString(),
        ];
    }
}
