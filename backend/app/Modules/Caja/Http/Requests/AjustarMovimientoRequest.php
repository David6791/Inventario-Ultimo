<?php

namespace App\Modules\Caja\Http\Requests;

/** Monto real de un comprobante provisional (lo que costó en verdad). */
class AjustarMovimientoRequest extends FormularioCaja
{
    protected string $permiso = 'caja.registrar';

    protected function prepareForValidation(): void
    {
        $this->colapsarEspacios('motivo', 'documento');
    }

    public function rules(): array
    {
        return [
            'monto'     => ['required', 'numeric', 'gt:0', 'max:999999999999', 'decimal:0,2'],
            'motivo'    => ['required', 'string', 'min:5', 'max:250'],
            'documento' => ['nullable', 'string', 'max:60'],
        ];
    }

    public function messages(): array
    {
        return [
            'monto.gt'        => 'El monto final debe ser mayor que cero. Si no se gastó nada, anule el comprobante.',
            'monto.decimal'   => 'El monto lleva como máximo dos decimales.',
            'motivo.required' => 'Explique el ajuste (por ejemplo: el repuesto costó más).',
            'motivo.min'      => 'Explique el ajuste con un poco más de detalle.',
        ];
    }
}
