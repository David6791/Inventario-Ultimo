<?php

namespace App\Http\Requests;

use App\Enums\Permisos;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RolRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // La autorización real vive en la Policy del controlador.
    }

    public function rules(): array
    {
        $rolId = $this->route('rol')?->id;

        return [
            'name' => [
                'required', 'string', 'max:60',
                'regex:/^[\pL\pN\s\-]+$/u',
                Rule::unique('roles', 'name')->ignore($rolId),
                Rule::notIn([Permisos::SUPER_ADMIN]),
            ],
            'descripcion' => ['nullable', 'string', 'max:200'],

            'permisos'   => ['present', 'array'],
            // Solo se aceptan permisos del catálogo. Sin esto, un POST manual
            // podría crear permisos inventados que nada en el código consulta.
            'permisos.*' => ['string', Rule::in(Permisos::todos())],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre del rol es obligatorio.',
            'name.unique'   => 'Ya existe un rol con ese nombre.',
            'name.regex'    => 'El nombre solo admite letras, números, espacios y guiones.',
            'name.not_in'   => 'Ese nombre está reservado por el sistema.',
            'permisos.*.in' => 'Uno de los permisos enviados no existe en el catálogo.',
        ];
    }

    public function attributes(): array
    {
        return ['name' => 'nombre'];
    }
}
