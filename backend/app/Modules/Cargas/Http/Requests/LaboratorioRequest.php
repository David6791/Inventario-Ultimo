<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\Laboratorio;
use Illuminate\Validation\Rule;

class LaboratorioRequest extends CatalogoRequest
{
    protected function prepareForValidation(): void
    {
        $this->colapsarEspacios('nombre');
        $this->mayusculas('nit');
    }

    public function rules(): array
    {
        $id = $this->route('laboratorio')?->id;

        return [
            'nombre'     => ['required', 'string', 'max:120', Rule::unique(Laboratorio::class, 'nombre')->ignore($id)],
            'nit'        => ['nullable', 'string', 'max:20'],
            'propio'     => ['boolean'],
            'acreditado' => ['boolean'],
            'activo'     => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return ['nombre.unique' => 'Ya hay un laboratorio con ese nombre.'];
    }
}
