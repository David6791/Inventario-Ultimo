<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Reglas comunes de cabecera y detalle. Cada tipo agrega las suyas. */
abstract class SolicitudBaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // La autorización vive en el controlador.
    }

    /** Reglas propias del tipo de solicitud. */
    abstract protected function reglasPropias(): array;

    public function rules(): array
    {
        return array_merge([
            'fecha'              => ['required', 'date', 'before_or_equal:today'],
            'unidad_solicitante' => ['required', 'string', 'max:150'],
            'solicitante'        => ['required', 'string', 'max:150'],
            'justificacion'      => ['nullable', 'string', 'max:2000'],
            'observaciones'      => ['nullable', 'string', 'max:2000'],

            'detalles'                  => ['required', 'array', 'min:1'],
            'detalles.*.producto_id'    => ['required', 'integer', Rule::exists('productos', 'id')],
            'detalles.*.cantidad'       => ['required', 'numeric', 'gt:0'],
            'detalles.*.especificacion' => ['nullable', 'string', 'max:300'],
        ], $this->reglasPropias());
    }

    /**
     * Un mismo producto dos veces rompe la clave única del detalle y, sobre
     * todo, vuelve ambiguo el cálculo de saldos.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $ids = collect($this->input('detalles', []))->pluck('producto_id');

            if ($ids->count() !== $ids->unique()->count()) {
                $validator->errors()->add(
                    'detalles',
                    'Hay un producto repetido en el detalle. Sume las cantidades en una sola línea.'
                );
            }
        });
    }

    public function messages(): array
    {
        return [
            'fecha.before_or_equal'  => 'La fecha no puede ser posterior a hoy.',
            'detalles.required'      => 'Agregue al menos un producto a la solicitud.',
            'detalles.min'           => 'Agregue al menos un producto a la solicitud.',
            'detalles.*.cantidad.gt' => 'La cantidad debe ser mayor que cero.',
        ];
    }

    public function attributes(): array
    {
        return ['unidad_solicitante' => 'unidad solicitante'];
    }
}
