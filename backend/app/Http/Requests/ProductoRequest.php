<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = $this->route('producto')?->id;

        return [
            'codigo' => [
                'required', 'string', 'max:30', 'regex:/^[A-Za-z0-9\-\.]+$/',
                Rule::unique('productos', 'codigo')->ignore($id),
            ],
            'nombre'      => ['required', 'string', 'max:200'],
            'descripcion' => ['nullable', 'string', 'max:500'],

            'categoria_id'     => ['required', 'integer', Rule::exists('categorias', 'id')],
            'unidad_medida_id' => ['required', 'integer', Rule::exists('unidades_medida', 'id')],

            'partida_presupuestaria' => ['nullable', 'string', 'max:20'],
            'codigo_barras'          => [
                'nullable', 'string', 'max:60',
                Rule::unique('productos', 'codigo_barras')->ignore($id),
            ],

            'stock_minimo' => ['required', 'numeric', 'min:0'],
            'stock_maximo' => ['nullable', 'numeric', 'min:0', 'gte:stock_minimo'],

            'controla_lote'        => ['boolean'],
            'controla_vencimiento' => ['boolean'],
            'activo'               => ['boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('codigo')) {
            $this->merge(['codigo' => mb_strtoupper(trim($this->input('codigo')))]);
        }
    }

    public function messages(): array
    {
        return [
            'codigo.required'           => 'El código es obligatorio.',
            'codigo.unique'             => 'Ya existe un producto con ese código.',
            'codigo.regex'              => 'El código solo admite letras, números, guiones y puntos.',
            'nombre.required'           => 'El nombre es obligatorio.',
            'categoria_id.required'     => 'Elija una categoría.',
            'unidad_medida_id.required' => 'Elija una unidad de medida.',
            'codigo_barras.unique'      => 'Ese código de barras ya está asignado a otro producto.',
            'stock_minimo.required'     => 'Indique el stock mínimo. Use 0 si no controla mínimos.',
            'stock_maximo.gte'          => 'El stock máximo no puede ser menor que el mínimo.',
        ];
    }

    public function attributes(): array
    {
        return [
            'stock_minimo'     => 'stock mínimo',
            'stock_maximo'     => 'stock máximo',
            'categoria_id'     => 'categoría',
            'unidad_medida_id' => 'unidad de medida',
        ];
    }
}
