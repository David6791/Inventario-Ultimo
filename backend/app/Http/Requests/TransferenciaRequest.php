<?php

namespace App\Http\Requests;

use App\Models\Existencia;
use App\Models\Producto;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TransferenciaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'almacen_destino_id' => [
                'required', 'integer', Rule::exists('almacenes', 'id'),
                // El origen es siempre el almacén activo, así que basta con
                // verificar que el destino sea otro.
                Rule::notIn([(int) app('almacen_actual')]),
            ],

            'fecha'         => ['required', 'date', 'before_or_equal:today'],
            'motivo'        => ['nullable', 'string', 'max:2000'],
            'transportista' => ['nullable', 'string', 'max:150'],

            'detalles'               => ['required', 'array', 'min:1'],
            'detalles.*.producto_id' => ['required', 'integer', Rule::exists('productos', 'id')],
            'detalles.*.cantidad'    => ['required', 'numeric', 'gt:0'],
            'detalles.*.observacion' => ['nullable', 'string', 'max:300'],
        ];
    }

    /**
     * No se puede trasladar más de lo que hay en el origen.
     *
     * Se verifica acá y otra vez al despachar: entre armar el borrador y
     * despacharlo el saldo puede cambiar.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $lineas = collect($this->input('detalles', []));

            if ($lineas->isEmpty()) {
                return;
            }

            $ids = $lineas->pluck('producto_id')->filter()->map(fn ($i) => (int) $i);

            if ($ids->count() !== $ids->unique()->count()) {
                $validator->errors()->add(
                    'detalles',
                    'Hay un producto repetido en el detalle. Sume las cantidades en una sola línea.'
                );
                return;
            }

            $origenId = (int) app('almacen_actual');
            $saldos   = Existencia::disponibles($ids->all(), $origenId);
            $nombres  = Producto::whereIn('id', $ids)->pluck('nombre', 'id');

            foreach ($lineas as $indice => $linea) {
                $productoId = (int) ($linea['producto_id'] ?? 0);
                $pedido     = (float) ($linea['cantidad'] ?? 0);
                $disponible = $saldos[$productoId] ?? 0.0;

                if ($pedido <= $disponible) {
                    continue;
                }

                $nombre = $nombres[$productoId] ?? 'el producto';

                $validator->errors()->add(
                    "detalles.{$indice}.cantidad",
                    $disponible > 0
                        ? "Solo hay {$this->formato($disponible)} de {$nombre} en este almacén."
                        : "No hay existencias de {$nombre} en este almacén."
                );
            }
        });
    }

    private function formato(float $cantidad): string
    {
        return rtrim(rtrim(number_format($cantidad, 4, ',', '.'), '0'), ',');
    }

    public function messages(): array
    {
        return [
            'almacen_destino_id.required' => 'Elija el almacén de destino.',
            'almacen_destino_id.not_in'   => 'El destino no puede ser el mismo almacén de origen.',
            'fecha.before_or_equal'  => 'La fecha no puede ser posterior a hoy.',
            'detalles.required'      => 'Agregue al menos un producto.',
            'detalles.*.cantidad.gt' => 'La cantidad debe ser mayor que cero.',
        ];
    }

    public function attributes(): array
    {
        return ['almacen_destino_id' => 'almacén de destino'];
    }
}
