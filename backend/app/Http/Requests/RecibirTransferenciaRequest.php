<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Confirmación de recepción en el almacén destino.
 *
 * Se declara lo que realmente llegó. Si es menos de lo despachado, el motivo es
 * obligatorio: la diferencia se registra como merma valorizada y una pérdida sin
 * explicación no debería poder guardarse.
 */
class RecibirTransferenciaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'detalles'                        => ['required', 'array', 'min:1'],
            'detalles.*.id'                   => ['required', 'integer'],
            'detalles.*.cantidad_recibida'    => ['required', 'numeric', 'min:0'],
            'observacion'                     => ['nullable', 'string', 'max:300'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $transferencia = $this->route('transferencia');

            if (! $transferencia) {
                return;
            }

            $lineas = collect($this->input('detalles', []))->keyBy('id');
            $hayFaltante = false;

            foreach ($transferencia->detalles as $detalle) {
                $declarado = $lineas[$detalle->id] ?? null;

                if (! $declarado) {
                    $validator->errors()->add(
                        'detalles',
                        'Falta declarar la cantidad recibida de algún producto.'
                    );
                    continue;
                }

                $recibido   = (float) $declarado['cantidad_recibida'];
                $despachado = (float) $detalle->cantidad_despachada;

                if ($recibido > $despachado) {
                    $validator->errors()->add(
                        'detalles',
                        "De {$detalle->producto?->nombre} se despacharon {$despachado}: "
                        .'no se puede recibir más de lo que salió.'
                    );
                }

                if ($recibido < $despachado) {
                    $hayFaltante = true;
                }
            }

            if ($hayFaltante && blank($this->input('observacion'))) {
                $validator->errors()->add(
                    'observacion',
                    'Hay faltantes respecto de lo despachado. Explique qué pasó: '
                    .'la diferencia se registra como pérdida valorizada.'
                );
            }
        });
    }

    public function messages(): array
    {
        return [
            'detalles.required' => 'Declare las cantidades recibidas.',
            'detalles.*.cantidad_recibida.required' => 'Indique cuánto llegó de cada producto.',
        ];
    }
}
