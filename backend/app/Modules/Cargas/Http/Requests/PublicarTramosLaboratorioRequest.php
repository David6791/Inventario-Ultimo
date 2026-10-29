<?php

namespace App\Modules\Cargas\Http\Requests;

use Illuminate\Validation\Validator;

/** Nueva tabla del bono de laboratorio (monto por cantidad de elementos), vigente desde una fecha. */
class PublicarTramosLaboratorioRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.configurar-bono';

    public function rules(): array
    {
        return [
            'vigente_desde'            => ['required', 'date', 'after_or_equal:today'],
            'tramos'                   => ['required', 'array', 'min:1', 'max:9'],
            'tramos.*.num_elementos'   => ['required', 'integer', 'between:1,9'],
            'tramos.*.monto'           => ['required', 'numeric', 'min:0', 'decimal:0,2'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            $n = collect($this->input('tramos'))->pluck('num_elementos')->map(fn ($x) => (int) $x);
            if ($n->duplicates()->isNotEmpty()) {
                $v->errors()->add('tramos', 'Cada cantidad de elementos va una sola vez.');
            }
        }];
    }

    public function messages(): array
    {
        return ['vigente_desde.after_or_equal' => 'La tabla rige desde hoy o una fecha futura: los bonos ya calculados no cambian.'];
    }
}
