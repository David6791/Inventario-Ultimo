<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Categoria */
class CategoriaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'codigo'      => $this->codigo,
            'nombre'      => $this->nombre,
            'descripcion' => $this->descripcion,
            'activo'      => (bool) $this->activo,
            'productos'   => $this->whenCounted('productos'),
        ];
    }
}
