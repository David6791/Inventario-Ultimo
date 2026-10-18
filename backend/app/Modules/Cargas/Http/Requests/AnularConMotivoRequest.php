<?php

namespace App\Modules\Cargas\Http\Requests;

/** Anulación con motivo (lote o pesaje). El permiso lo fija la ruta: ver subclases. */
class AnularConMotivoRequest extends CatalogoRequest
{
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
            'motivo.required' => 'Indique el motivo de la anulación.',
            'motivo.min'      => 'Explique el motivo con al menos 10 caracteres.',
        ];
    }
}
