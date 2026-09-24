<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\User */
class UsuarioResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'       => $this->id,
            'ci'       => $this->ci,
            'name'     => $this->name,
            'email'    => $this->email,
            'cargo'    => $this->cargo,
            'telefono' => $this->telefono,
            'activo'   => (bool) $this->activo,
            'debe_cambiar_clave' => (bool) $this->debe_cambiar_clave,
            'ultimo_acceso_en'   => $this->ultimo_acceso_en?->toIso8601String(),

            'roles' => $this->whenLoaded('roles', fn () => $this->roles->map(fn ($r) => [
                'id'   => $r->id,
                'name' => $r->name,
            ])),

            'almacenes' => $this->whenLoaded('almacenes', fn () => $this->almacenes->map(fn ($a) => [
                'id'     => $a->id,
                'codigo' => $a->codigo,
                'nombre' => $a->nombre,
                'es_predeterminado' => (bool) $a->pivot->es_predeterminado,
            ])),
        ];
    }
}
