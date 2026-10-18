<?php

namespace App\Modules\Caja\Http\Requests;

use App\Modules\Caja\Models\Persona;
use Illuminate\Validation\Rule;

/**
 * Corrección de los datos de una persona del registro. Los comprobantes ya
 * emitidos conservan el nombre y el CI con que se emitieron.
 */
class PersonaRequest extends FormularioCaja
{
    protected function prepareForValidation(): void
    {
        $this->mayusculas('nombre', 'ci');
        $this->colapsarEspacios('telefono', 'observaciones');
    }

    public function rules(): array
    {
        return [
            'nombre'        => ['required', 'string', 'max:150'],
            'ci'            => ['nullable', 'string', 'max:15',
                                Rule::unique(Persona::class, 'ci')->ignore($this->route('persona')?->id)],
            'telefono'      => ['nullable', 'string', 'max:30'],
            'observaciones' => ['nullable', 'string', 'max:250'],
            'activo'        => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return ['ci.unique' => 'Ya hay otra persona registrada con ese CI o NIT.'];
    }
}
