<?php

namespace App\Modules\Cargas\Http\Requests;

use Illuminate\Validation\Rule;

/** Corrección del peso declarado por el cliente: valor (vacío = no declaró), bruto o neto, y motivo. */
class CorregirPesoClienteRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.recibir';

    protected function prepareForValidation(): void
    {
        $this->colapsarEspacios('motivo');
    }

    public function rules(): array
    {
        return [
            'peso_cliente_kg'   => ['nullable', 'numeric', 'gt:0', 'max:9999999', 'decimal:0,2'],
            'peso_cliente_tipo' => ['required', Rule::in(['NETO', 'BRUTO'])],
            'motivo'            => ['required', 'string', 'min:10', 'max:250'],
        ];
    }

    public function messages(): array
    {
        return [
            'motivo.required' => 'Indique por qué se corrige el peso del cliente.',
            'motivo.min'      => 'Explique el motivo con al menos 10 caracteres.',
        ];
    }
}
