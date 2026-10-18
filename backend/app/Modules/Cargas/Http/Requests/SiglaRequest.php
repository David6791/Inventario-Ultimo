<?php

namespace App\Modules\Cargas\Http\Requests;

class SiglaRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.series';

    protected function prepareForValidation(): void
    {
        $this->mayusculas('sigla');
    }

    public function rules(): array
    {
        return ['sigla' => ['required', 'string', 'max:10', 'regex:/^[A-Z0-9]+$/']];
    }

    public function messages(): array
    {
        return ['sigla.regex' => 'La sigla va en mayúsculas y números, sin espacios ni signos.'];
    }
}
