<?php

namespace App\Modules\Caja\Http\Requests;

use App\Models\User;
use Illuminate\Validation\Rule;

/** Asignación de cajeros a una caja: la lista completa, reemplaza la anterior. */
class CajerosRequest extends FormularioCaja
{
    public function rules(): array
    {
        return [
            'usuarios'   => ['present', 'array'],
            'usuarios.*' => ['integer', 'distinct', Rule::exists(User::class, 'id')->where('activo', true)],
        ];
    }

    public function messages(): array
    {
        return ['usuarios.*.exists' => 'Uno de los usuarios elegidos no existe o está inactivo.'];
    }
}
