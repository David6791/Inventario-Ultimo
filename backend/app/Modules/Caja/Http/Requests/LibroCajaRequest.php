<?php

namespace App\Modules\Caja\Http\Requests;

use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Concepto;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** Filtros del libro de caja: rango de fechas, caja, concepto y moneda. */
class LibroCajaRequest extends FormularioCaja
{
    protected string $permiso = 'caja.reportes';

    public function rules(): array
    {
        return [
            'desde'            => ['required', 'date'],
            'hasta'            => ['required', 'date', 'after_or_equal:desde'],
            'caja_id'          => ['nullable', 'integer', Rule::exists(Caja::class, 'id')],
            'concepto_id'      => ['nullable', 'integer', Rule::exists(Concepto::class, 'id')],
            'moneda'           => ['nullable', Rule::in(['BOB', 'USD'])],
            'incluir_anulados' => ['nullable', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            if ($v->errors()->isEmpty()
                && \Carbon\Carbon::parse($this->input('desde'))->diffInDays($this->input('hasta')) > 366) {
                $v->errors()->add('hasta', 'El rango no puede pasar de un año.');
            }
        }];
    }

    public function messages(): array
    {
        return ['hasta.after_or_equal' => 'La fecha final debe ser igual o posterior a la inicial.'];
    }
}
