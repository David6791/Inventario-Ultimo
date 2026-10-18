<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Comun\Models\Banco;
use Illuminate\Validation\Rule;

class BancoRequest extends CatalogoRequest
{
    protected function prepareForValidation(): void
    {
        $this->colapsarEspacios('nombre');
    }

    public function rules(): array
    {
        $id = $this->route('banco')?->id;

        return [
            'nombre' => ['required', 'string', 'max:60', Rule::unique(Banco::class, 'nombre')->ignore($id)],
            'activo' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return ['nombre.unique' => 'Ya hay un banco con ese nombre.'];
    }
}
