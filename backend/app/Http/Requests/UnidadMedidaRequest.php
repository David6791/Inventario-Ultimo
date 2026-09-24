<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UnidadMedidaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = $this->route('unidad')?->id;

        return [
            'codigo' => [
                'required', 'string', 'max:10', 'regex:/^[A-Za-z0-9]+$/',
                Rule::unique('unidades_medida', 'codigo')->ignore($id),
            ],
            'nombre'            => ['required', 'string', 'max:60'],
            'permite_decimales' => ['boolean'],
            'activo'            => ['boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('codigo')) {
            $this->merge(['codigo' => mb_strtoupper(trim($this->input('codigo')))]);
        }
    }

    public function messages(): array
    {
        return [
            'codigo.required' => 'El código es obligatorio.',
            'codigo.unique'   => 'Ya existe una unidad con ese código.',
            'codigo.regex'    => 'El código solo admite letras y números.',
            'nombre.required' => 'El nombre es obligatorio.',
        ];
    }
}
