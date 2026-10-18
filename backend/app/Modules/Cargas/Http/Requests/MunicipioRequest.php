<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\Municipio;
use Illuminate\Validation\Rule;

class MunicipioRequest extends CatalogoRequest
{
    protected function prepareForValidation(): void
    {
        $this->mayusculas('codigo', 'departamento');
        $this->colapsarEspacios('nombre');
        if (! $this->filled('departamento')) {
            $this->merge(['departamento' => 'POTOSI']);
        }
    }

    public function rules(): array
    {
        $id = $this->route('municipio')?->id;

        return [
            'codigo'       => ['nullable', 'string', 'max:10', Rule::unique(Municipio::class, 'codigo')->ignore($id)],
            'nombre'       => ['required', 'string', 'max:100',
                               Rule::unique(Municipio::class, 'nombre')->where('departamento', $this->input('departamento'))->ignore($id)],
            'departamento' => ['required', Rule::in(Municipio::DEPARTAMENTOS)],
        ];
    }

    public function messages(): array
    {
        return [
            'codigo.unique' => 'Ya hay un municipio con ese código.',
            'nombre.unique' => 'Ese municipio ya está registrado en el departamento.',
        ];
    }
}
