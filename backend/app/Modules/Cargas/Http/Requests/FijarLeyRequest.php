<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\LoteLey;
use Illuminate\Validation\Rule;

/** Ley final de un elemento: el criterio decide el valor (salvo ACUERDO, que lo digita con observación). */
class FijarLeyRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.fijar-ley';

    protected function prepareForValidation(): void
    {
        $this->colapsarEspacios('observacion');
    }

    public function rules(): array
    {
        return [
            'criterio'    => ['required', Rule::in(LoteLey::CRITERIOS)],
            'valor'       => ['required_if:criterio,ACUERDO', 'nullable', 'numeric', 'min:0', 'max:99999999', 'decimal:0,4'],
            'observacion' => ['required_if:criterio,ACUERDO', 'nullable', 'string', 'min:10', 'max:250'],
        ];
    }

    public function messages(): array
    {
        return [
            'valor.required_if'       => 'Indique el valor acordado.',
            'observacion.required_if' => 'Explique el acuerdo (con quién y por qué).',
            'observacion.min'         => 'Explique el acuerdo con al menos 10 caracteres.',
        ];
    }
}
