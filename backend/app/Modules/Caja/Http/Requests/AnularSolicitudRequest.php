<?php

namespace App\Modules\Caja\Http\Requests;

/** Anular una solicitud pendiente o aprobada: quien la registró o un cajero (la base lo exige). */
class AnularSolicitudRequest extends FormularioCaja
{
    public function authorize(): bool
    {
        $usuario = $this->user();

        return $usuario !== null && ($usuario->can('caja.solicitar') || $usuario->can('caja.registrar'));
    }

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
            'motivo.required' => 'Indique por qué se anula la solicitud.',
            'motivo.min'      => 'Explique el motivo con al menos 10 caracteres.',
        ];
    }
}
