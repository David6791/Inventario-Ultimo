<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Role */
class RolResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'name'        => $this->name,
            'descripcion' => $this->descripcion,
            'es_sistema'  => (bool) $this->es_sistema,
            'usuarios'    => $this->whenCounted('users'),
            'permisos'    => $this->whenLoaded('permissions', fn () => $this->permissions->pluck('name')),
            'puede_editarse'   => $request->user()?->can('update', $this->resource) ?? false,
            'puede_eliminarse' => $request->user()?->can('delete', $this->resource) ?? false,
            'creado_en'   => $this->created_at?->toIso8601String(),
        ];
    }
}
