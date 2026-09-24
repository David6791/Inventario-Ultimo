<?php

namespace App\Http\Requests;

use App\Enums\Permisos;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UsuarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $usuarioId = $this->route('usuario')?->id;
        $esCreacion = $this->isMethod('POST');

        return [
            'name'  => ['required', 'string', 'max:120'],
            'ci'    => ['nullable', 'string', 'max:20', Rule::unique('users', 'ci')->ignore($usuarioId)],
            'email' => [
                'required', 'email', 'max:150',
                Rule::unique('users', 'email')->ignore($usuarioId),
            ],
            'cargo'    => ['nullable', 'string', 'max:120'],
            'telefono' => ['nullable', 'string', 'max:30'],
            'activo'   => ['boolean'],

            'password' => [
                $esCreacion ? 'required' : 'nullable',
                'confirmed',
                Password::min(8)->letters()->numbers(),
            ],

            'roles'   => ['present', 'array', 'min:1'],
            'roles.*' => [
                'string',
                Rule::exists('roles', 'name'),
                // Solo un super-admin puede repartir el rol super-admin.
                Rule::when(
                    ! $this->user()->hasRole(Permisos::SUPER_ADMIN),
                    [Rule::notIn([Permisos::SUPER_ADMIN])]
                ),
            ],

            'almacenes'   => ['present', 'array'],
            'almacenes.*' => ['integer', Rule::exists('almacenes', 'id')],

            'almacen_predeterminado_id' => [
                'nullable', 'integer',
                Rule::in($this->input('almacenes', [])),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'roles.min'    => 'Asigne al menos un rol al usuario.',
            'roles.*.not_in' => 'No tiene permiso para asignar el rol de administrador.',
            'email.unique' => 'Ese correo ya está registrado.',
            'ci.unique'    => 'Ese número de carnet ya está registrado.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
            'almacen_predeterminado_id.in' => 'El almacén predeterminado debe estar entre los asignados.',
        ];
    }

    public function attributes(): array
    {
        return [
            'name'     => 'nombre',
            'password' => 'contraseña',
            'ci'       => 'carnet de identidad',
        ];
    }
}
