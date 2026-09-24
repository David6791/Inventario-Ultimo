<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UnidadSolicitanteRequest extends FormRequest
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
                'required', 'string', 'max:20', 'regex:/^[A-Za-z0-9\-]+$/',
                Rule::unique('unidades_solicitantes', 'codigo')->ignore($id),
            ],
            'nombre'       => ['required', 'string', 'max:150'],
            'responsable'  => ['nullable', 'string', 'max:150'],
            'centro_costo' => ['nullable', 'string', 'max:60'],
            'activo'       => ['boolean'],
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
            'nombre.required' => 'El nombre es obligatorio.',
        ];
    }
}
