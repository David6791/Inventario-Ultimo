<?php

namespace App\Modules\Caja\Http\Requests;

class AnularMovimientoRequest extends FormularioCaja
{
    protected string $permiso = 'caja.anular';

    protected function prepareForValidation(): void
    {
        $this->colapsarEspacios('motivo');
    }

    public function rules(): array
    {
        return ['motivo' => ['required', 'string', 'min:10', 'max:250']];
    }

    public function messages(): array
    {
        return [
            'motivo.required' => 'Indique por qué se anula el comprobante.',
            'motivo.min'      => 'Explique el motivo con al menos 10 caracteres.',
        ];
    }
}
