<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Almacen */
class AlmacenResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'codigo'      => $this->codigo,
            'nombre'      => $this->nombre,
            'ubicacion'   => $this->ubicacion,
            'responsable' => $this->responsable,
            'activo'      => (bool) $this->activo,
            'usuarios'    => $this->whenCounted('usuarios'),
        ];
    }
}
