<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Solicitante */
class SolicitanteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                    => $this->id,
            'unidad_solicitante_id' => $this->unidad_solicitante_id,
            'unidad'                => $this->whenLoaded('unidad', fn () => $this->unidad->nombre),
            'centro_costo'          => $this->whenLoaded('unidad', fn () => $this->unidad->centro_costo),

            'nombre'             => $this->nombre,
            'ci'                 => $this->ci,
            'cargo'              => $this->cargo,
            'telefono'           => $this->telefono,
            'autorizado_retirar' => (bool) $this->autorizado_retirar,
            'activo'             => (bool) $this->activo,
        ];
    }
}
