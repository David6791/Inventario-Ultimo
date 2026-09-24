<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SolicitanteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = $this->route('solicitante')?->id;

        return [
            'unidad_solicitante_id' => [
                'required', 'integer', Rule::exists('unidades_solicitantes', 'id'),
            ],
            'nombre' => [
                'required', 'string', 'max:150',
                // Dos personas con el mismo nombre en la misma unidad hacen
                // imposible elegir bien en el desplegable de la salida.
                Rule::unique('solicitantes', 'nombre')
                    ->where('unidad_solicitante_id', $this->input('unidad_solicitante_id'))
                    ->ignore($id),
            ],
            'ci'                 => ['nullable', 'string', 'max:20'],
            'cargo'              => ['nullable', 'string', 'max:120'],
            'telefono'           => ['nullable', 'string', 'max:30'],
            'autorizado_retirar' => ['boolean'],
            'activo'             => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'unidad_solicitante_id.required' => 'Elija la unidad a la que pertenece.',
            'nombre.required' => 'El nombre es obligatorio.',
            'nombre.unique'   => 'Ya hay alguien con ese nombre en esa unidad.',
        ];
    }

    public function attributes(): array
    {
        return ['unidad_solicitante_id' => 'unidad'];
    }
}
