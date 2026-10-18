<?php

namespace App\Modules\Cargas\Http\Requests;

use Illuminate\Validation\Rule;

/** Lectura estimada al recibir (visual o portátil). Valor vacío = quitar la lectura de ese elemento. */
class LecturaEstimadaRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.recibir';

    protected function prepareForValidation(): void
    {
        $this->colapsarEspacios('metodo');
    }

    public function rules(): array
    {
        return [
            'metodo'                 => ['nullable', 'string', 'max:30'],
            'lecturas'               => ['required', 'array', 'min:1'],
            'lecturas.*.elemento_id' => ['required', 'integer', 'distinct', Rule::exists(\App\Modules\Cargas\Models\Elemento::class, 'id')],
            'lecturas.*.valor'       => ['nullable', 'numeric', 'min:0', 'max:99999999', 'decimal:0,4'],
        ];
    }
}
