<?php

namespace App\Modules\Caja\Http\Requests;

use App\Modules\Caja\Models\Persona;
use Illuminate\Validation\Rule;

/** Unificar una persona duplicada con la que se conserva. */
class UnificarPersonaRequest extends FormularioCaja
{
    public function rules(): array
    {
        return [
            'destino_id' => ['required', 'integer', 'different:origen', Rule::exists(Persona::class, 'id')],
            'motivo'     => ['nullable', 'string', 'max:250'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['origen' => $this->route('persona')?->id]);
    }

    public function messages(): array
    {
        return [
            'destino_id.required'  => 'Elija la persona que se conserva.',
            'destino_id.different' => 'Elija una persona distinta de la que se unifica.',
        ];
    }
}
