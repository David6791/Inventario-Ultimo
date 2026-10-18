<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\Bocamina;
use Illuminate\Validation\Rule;

class BocaminaRequest extends CatalogoRequest
{
    protected function prepareForValidation(): void
    {
        $this->mayusculas('codigo');
        $this->colapsarEspacios('nombre');
    }

    public function rules(): array
    {
        $bocamina = $this->route('bocamina');
        $minaId = $bocamina?->mina_id ?? $this->route('mina')?->id;

        return [
            'codigo' => ['required', 'string', 'max:20',
                         Rule::unique(Bocamina::class, 'codigo')->where('mina_id', $minaId)->ignore($bocamina?->id)],
            'nombre' => ['nullable', 'string', 'max:100'],
            'activa' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return ['codigo.unique' => 'Esa mina ya tiene una bocamina con ese código.'];
    }
}
