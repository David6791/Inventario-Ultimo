<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\UnidadSolicitante */
class UnidadSolicitanteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'codigo'       => $this->codigo,
            'nombre'       => $this->nombre,
            'responsable'  => $this->responsable,
            'centro_costo' => $this->centro_costo,
            'activo'       => (bool) $this->activo,
            'solicitantes' => $this->whenCounted('solicitantes'),
        ];
    }
}
