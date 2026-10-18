<?php

namespace App\Modules\Cargas\Http\Requests;

use Illuminate\Validation\Validator;

/** Nueva tabla de tramos del bono de transporte, vigente desde una fecha. */
class PublicarTramosRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.configurar-bono';

    public function rules(): array
    {
        return [
            'vigente_desde'           => ['required', 'date', 'after_or_equal:today'],
            'tramos'                  => ['required', 'array', 'min:1', 'max:30'],
            'tramos.*.tipo_vehiculo'  => ['required', 'string', 'max:30'],
            'tramos.*.peso_desde_kg'  => ['required', 'numeric', 'min:0'],
            'tramos.*.peso_hasta_kg'  => ['nullable', 'numeric', 'gt:tramos.*.peso_desde_kg'],
            'tramos.*.monto'          => ['required', 'numeric', 'min:0', 'decimal:0,2'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            if ($v->errors()->isNotEmpty()) {
                return;
            }
            $tramos = collect($this->input('tramos'))->sortBy('peso_desde_kg')->values();
            foreach ($tramos as $i => $t) {
                $sig = $tramos[$i + 1] ?? null;
                if ($sig && ($t['peso_hasta_kg'] === null || $t['peso_hasta_kg'] === '' || (float) $t['peso_hasta_kg'] > (float) $sig['peso_desde_kg'])) {
                    $v->errors()->add('tramos', "Los tramos «{$t['tipo_vehiculo']}» y «{$sig['tipo_vehiculo']}» se superponen: cada tramo termina donde empieza el siguiente.");
                }
            }
        }];
    }

    public function messages(): array
    {
        return [
            'vigente_desde.after_or_equal'  => 'La tabla rige desde hoy o una fecha futura: los bonos ya calculados no cambian.',
            'tramos.*.peso_hasta_kg.gt'     => 'En cada tramo, el peso hasta debe ser mayor que el peso desde.',
        ];
    }
}
