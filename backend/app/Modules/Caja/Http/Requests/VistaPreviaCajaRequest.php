<?php

namespace App\Modules\Caja\Http\Requests;

use App\Modules\Caja\Models\Caja;
use Illuminate\Validation\Rule;

/** Vista previa del número de comprobante mientras se edita el formato. No guarda nada. */
class VistaPreviaCajaRequest extends FormularioCaja
{
    protected function prepareForValidation(): void
    {
        $this->mayusculas('codigo', 'reinicio_comprobante');
    }

    public function rules(): array
    {
        return [
            'caja_id'              => ['nullable', 'integer', Rule::exists(Caja::class, 'id')],
            'codigo'               => ['nullable', 'string', 'max:10'],
            'formato_comprobante'  => ['nullable', 'string', 'max:80'],
            'reinicio_comprobante' => ['nullable', Rule::in(Caja::REINICIOS)],
            'fecha'                => ['nullable', 'date'],
            'proximo_comprobante'  => ['nullable', 'integer', 'min:1', 'max:99999999'],
            'numeracion_separada'  => ['nullable', 'boolean'],
            'formato_ingreso'      => ['nullable', 'string', 'max:80'],
            'proximo_ingreso'      => ['nullable', 'integer', 'min:1', 'max:99999999'],
        ];
    }
}
