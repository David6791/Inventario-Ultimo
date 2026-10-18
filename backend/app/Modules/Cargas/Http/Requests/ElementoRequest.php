<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\Elemento;
use Illuminate\Validation\Rule;

/**
 * Alta y edición de elementos. El código solo se fija al crear: la base no
 * deja cambiarlo después. La unidad de ley tampoco cambia si el elemento ya
 * tiene análisis, leyes, precios o cotizaciones (lo controla la base).
 */
class ElementoRequest extends CatalogoRequest
{
    protected function prepareForValidation(): void
    {
        $this->mayusculas('codigo');
        $this->colapsarEspacios('nombre');
    }

    public function rules(): array
    {
        $elemento = $this->route('elemento');

        return [
            'codigo' => $elemento
                ? ['prohibited']
                : ['required', 'string', 'max:10', 'regex:/^[A-Z][A-Z0-9]*$/', Rule::unique(Elemento::class, 'codigo')],
            'nombre'            => ['required', 'string', 'max:60'],
            'unidad_ley'        => ['required', Rule::in(array_keys(Elemento::UNIDADES_LEY))],
            'unidad_cotizacion' => ['nullable', Rule::in(array_keys(Elemento::UNIDADES_COTIZACION))],
            'activo'            => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'codigo.prohibited' => 'El código de un elemento no se cambia.',
            'codigo.regex'      => 'El código va en mayúsculas, empieza con una letra y no lleva espacios (por ejemplo ZN o SIO2).',
            'codigo.unique'     => 'Ya existe un elemento con ese código.',
        ];
    }
}
