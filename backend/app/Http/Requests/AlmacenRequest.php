<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AlmacenRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = $this->route('almacen')?->id;

        return [
            'codigo' => [
                'required', 'string', 'max:20', 'regex:/^[A-Za-z0-9\-]+$/',
                Rule::unique('almacenes', 'codigo')->ignore($id),
            ],
            'nombre'      => ['required', 'string', 'max:120'],
            'ubicacion'   => ['nullable', 'string', 'max:200'],
            'responsable' => ['nullable', 'string', 'max:120'],
            'activo'      => ['boolean'],
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
            'codigo.unique'   => 'Ya existe un almacén con ese código.',
            'nombre.required' => 'El nombre es obligatorio.',
        ];
    }
}
