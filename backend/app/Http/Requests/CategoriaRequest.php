<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CategoriaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // La autorización vive en el controlador.
    }

    public function rules(): array
    {
        $id = $this->route('categoria')?->id;

        return [
            'codigo' => [
                'required', 'string', 'max:20', 'regex:/^[A-Za-z0-9\-]+$/',
                Rule::unique('categorias', 'codigo')->ignore($id),
            ],
            'nombre'      => ['required', 'string', 'max:120'],
            'descripcion' => ['nullable', 'string', 'max:250'],
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
            'codigo.unique'   => 'Ya existe una categoría con ese código.',
            'codigo.regex'    => 'El código solo admite letras, números y guiones.',
            'nombre.required' => 'El nombre es obligatorio.',
        ];
    }
}
