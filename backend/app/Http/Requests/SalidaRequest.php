<?php

namespace App\Http\Requests;

use App\Models\Existencia;
use App\Models\Producto;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SalidaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // La autorización vive en el controlador.
    }

    public function rules(): array
    {
        return [
            'fecha' => ['required', 'date', 'before_or_equal:today'],

            'unidad_solicitante_id' => [
                'required', 'integer', Rule::exists('unidades_solicitantes', 'id'),
            ],
            'solicitante_id' => [
                'required', 'integer',
                // Tiene que pertenecer a la unidad elegida, o el documento
                // diría que pidió alguien de otra área.
                Rule::exists('solicitantes', 'id')
                    ->where('unidad_solicitante_id', $this->input('unidad_solicitante_id')),
            ],
            'recibido_por_id' => [
                'required', 'integer',
                Rule::exists('solicitantes', 'id')->where('autorizado_retirar', true),
            ],

            'centro_costo' => ['nullable', 'string', 'max:60'],
            'destino'            => ['nullable', 'string', 'max:200'],
            'motivo'             => ['nullable', 'string', 'max:2000'],

            'detalles'                => ['required', 'array', 'min:1'],
            'detalles.*.producto_id'  => ['required', 'integer', Rule::exists('productos', 'id')],
            'detalles.*.cantidad'     => ['required', 'numeric', 'gt:0'],
            'detalles.*.observacion'  => ['nullable', 'string', 'max:300'],
        ];
    }

    /**
     * Dos comprobaciones sobre el detalle.
     *
     * La de existencias se repite al confirmar: acá evita registrar un borrador
     * imposible, pero el saldo que manda es el del momento de descargar.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $lineas = collect($this->input('detalles', []));

            if ($lineas->isEmpty()) {
                return;
            }

            $ids = $lineas->pluck('producto_id')->filter()->map(fn ($id) => (int) $id);

            // Un producto repetido rompe la clave única y vuelve ambiguo el
            // movimiento de kardex.
            if ($ids->count() !== $ids->unique()->count()) {
                $validator->errors()->add(
                    'detalles',
                    'Hay un producto repetido en el detalle. Sume las cantidades en una sola línea.'
                );
                return;
            }

            $almacenId = (int) app('almacen_actual');
            $saldos  = Existencia::disponibles($ids->all(), $almacenId);
            $nombres = Producto::whereIn('id', $ids)->pluck('nombre', 'id');

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
            'fecha.before_or_equal'   => 'La fecha no puede ser posterior a hoy.',
            'unidad_solicitante_id.required' => 'Elija la unidad que solicita.',
            'solicitante_id.required'  => 'Elija quién solicita el material.',
            'solicitante_id.exists'    => 'Esa persona no pertenece a la unidad elegida.',
            'recibido_por_id.required' => 'Elija quién retira el material: es quien firma la nota.',
            'recibido_por_id.exists'   => 'Esa persona no está autorizada a retirar material.',
            'detalles.required'       => 'Agregue al menos un producto.',
            'detalles.min'            => 'Agregue al menos un producto.',
            'detalles.*.cantidad.gt'  => 'La cantidad debe ser mayor que cero.',
        ];
    }

    public function attributes(): array
    {
        return [
            'unidad_solicitante_id' => 'unidad solicitante',
            'solicitante_id'        => 'solicitante',
            'recibido_por_id'       => 'quien recibe',
            'centro_costo'          => 'centro de costo',
        ];
    }
}
