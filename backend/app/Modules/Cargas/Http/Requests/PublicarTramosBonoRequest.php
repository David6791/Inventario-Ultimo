<?php

namespace App\Modules\Cargas\Http\Requests;

use Illuminate\Validation\Validator;

/** Nueva tabla de montos de un bono, vigente desde una fecha. Las filas dependen del cálculo del bono. */
class PublicarTramosBonoRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.configurar-bono';

    public function rules(): array
    {
        $calculo = $this->route('tipo')?->calculo;

        return [
            'vigente_desde'    => ['required', 'date', 'after_or_equal:today'],
            'tramos'           => ['required', 'array', 'min:1', in_array($calculo, ['FIJO', 'POR_TONELADA'], true) ? 'max:1' : 'max:30'],
            'tramos.*.etiqueta' => ['nullable', 'string', 'max:30'],
            'tramos.*.desde'   => [$calculo === 'TRAMOS_PESO' || $calculo === 'POR_ELEMENTOS' ? 'required' : 'nullable', 'numeric', 'min:0',
                                   ...($calculo === 'POR_ELEMENTOS' ? ['integer', 'min:1', 'max:9'] : [])],
            'tramos.*.hasta'   => ['nullable', 'numeric', 'gt:tramos.*.desde'],
            'tramos.*.monto'   => ['required', 'numeric', 'min:0', 'decimal:0,2'],
            'tramos.*.moneda'  => ['nullable', 'in:BOB,USD'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            $tipo = $this->route('tipo');
            if ($v->errors()->isNotEmpty() || ! $tipo) {
                return;
            }
            if ($tipo->calculo === 'MANUAL') {
                $v->errors()->add('tramos', "El bono «{$tipo->nombre}» es de monto manual: no lleva tabla.");

                return;
            }
            $filas = collect($this->input('tramos'));
            if ($tipo->calculo === 'POR_ELEMENTOS' && $filas->pluck('desde')->map(fn ($n) => (int) $n)->duplicates()->isNotEmpty()) {
                $v->errors()->add('tramos', 'Cada cantidad de elementos va una sola vez.');
            }
            if ($tipo->calculo === 'TRAMOS_PESO') {
                $tramos = $filas->sortBy(fn ($t) => (float) $t['desde'])->values();
                foreach ($tramos as $i => $t) {
                    $sig = $tramos[$i + 1] ?? null;
                    if ($sig && (($t['hasta'] ?? null) === null || $t['hasta'] === '' || (float) $t['hasta'] > (float) $sig['desde'])) {
                        $v->errors()->add('tramos', 'Los tramos de ' . number_format((float) $t['desde'], 0, ',', '.') . ' kg y '
                            . number_format((float) $sig['desde'], 0, ',', '.') . ' kg se superponen: cada tramo termina donde empieza el siguiente.');
                    }
                }
            }
        }];
    }

    public function messages(): array
    {
        return [
            'vigente_desde.after_or_equal' => 'La tabla rige desde hoy o una fecha futura: los bonos ya calculados no cambian.',
            'tramos.*.hasta.gt'            => 'En cada tramo, el peso hasta debe ser mayor que el peso desde.',
            'tramos.max'                   => 'Este bono lleva un solo monto.',
        ];
    }
}
