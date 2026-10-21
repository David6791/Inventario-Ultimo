<?php

namespace App\Modules\Caja\Http\Requests;

use App\Modules\Caja\Models\Movimiento;
use App\Modules\Comun\Models\Banco;
use Illuminate\Validation\Rule;

/** Pago de una solicitud aprobada: solo se elige cómo se entrega el dinero. */
class PagarSolicitudRequest extends FormularioCaja
{
    protected string $permiso = 'caja.registrar';

    protected function prepareForValidation(): void
    {
        $this->mayusculas('forma_pago', 'nro_documento');
        if ($this->input('forma_pago', 'EFECTIVO') === 'EFECTIVO') {
            $this->merge(['banco_id' => null, 'nro_documento' => null]);
        }
    }

    public function rules(): array
    {
        return [
            'forma_pago'    => ['required', Rule::in(Movimiento::FORMAS_PAGO)],
            'banco_id'      => ['nullable', 'required_unless:forma_pago,EFECTIVO', 'integer',
                                Rule::exists(Banco::class, 'id')->where('activo', true)],
            'nro_documento' => ['nullable', 'required_unless:forma_pago,EFECTIVO', 'string', 'max:40'],
        ];
    }

    public function messages(): array
    {
        return [
            'banco_id.required_unless'      => 'Indique el banco del cheque o la transferencia.',
            'nro_documento.required_unless' => 'Indique el número del cheque o de la transferencia.',
        ];
    }
}
