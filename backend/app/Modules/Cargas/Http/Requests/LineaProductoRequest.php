<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\Elemento;
use App\Modules\Cargas\Models\LineaProducto;
use App\Modules\Cargas\Models\LineaProductoElemento;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** Línea de producto junto con sus elementos: se guardan en una sola operación. */
class LineaProductoRequest extends CatalogoRequest
{
    protected function prepareForValidation(): void
    {
        $this->mayusculas('codigo');
        $this->colapsarEspacios('nombre');
    }

    public function rules(): array
    {
        $id = $this->route('linea')?->id;

        return [
            'codigo'           => ['required', 'string', 'max:20', 'regex:/^[A-Z0-9_]+$/',
                                   Rule::unique(LineaProducto::class, 'codigo')->ignore($id)],
            'nombre'           => ['required', 'string', 'max:100'],
            'forma'            => ['required', Rule::in(LineaProducto::FORMAS)],
            'modalidad_precio' => ['required', Rule::in(array_keys(LineaProducto::MODALIDADES))],
            'activa'           => ['boolean'],

            'elementos'               => ['required', 'array', 'min:1'],
            'elementos.*.elemento_id' => ['required', 'integer', 'distinct', Rule::exists(Elemento::class, 'id')],
            'elementos.*.rol'         => ['required', Rule::in(LineaProductoElemento::ROLES)],
            'elementos.*.split_limit' => ['nullable', 'numeric', 'gt:0', 'max:99999999'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator) {
                $roles = collect($this->input('elementos', []))->pluck('rol');
                if ($roles->isNotEmpty() && ! $roles->contains('PAGABLE')) {
                    $validator->errors()->add('elementos', 'La línea necesita al menos un elemento PAGABLE: es lo que se le paga al productor.');
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'codigo.regex'                  => 'El código va en mayúsculas, sin espacios (letras, números y guion bajo).',
            'codigo.unique'                 => 'Ya existe una línea con ese código.',
            'elementos.required'            => 'Agregue al menos un elemento a la línea.',
            'elementos.*.elemento_id.distinct' => 'Un elemento aparece dos veces en la línea.',
            'elementos.*.split_limit.gt'    => 'El split limit debe ser mayor que cero.',
        ];
    }
}
