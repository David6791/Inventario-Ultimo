<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\UnidadMedida */
class UnidadMedidaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                => $this->id,
            'codigo'            => $this->codigo,
            'nombre'            => $this->nombre,
            'permite_decimales' => (bool) $this->permite_decimales,
            'activo'            => (bool) $this->activo,
            'productos'         => $this->whenCounted('productos'),
        ];
    }
}
