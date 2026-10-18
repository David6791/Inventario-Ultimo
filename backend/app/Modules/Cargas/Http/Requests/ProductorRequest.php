<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\Cooperativa;
use App\Modules\Cargas\Models\Productor;
use Illuminate\Validation\Rule;

class ProductorRequest extends CatalogoRequest
{
    protected function prepareForValidation(): void
    {
        $this->mayusculas('ci', 'nit', 'nim', 'tipo');
        $this->colapsarEspacios('nombre');

        // Solo el cooperativista pertenece a una cooperativa.
        if ($this->input('tipo') && $this->input('tipo') !== 'COOPERATIVISTA') {
            $this->merge(['cooperativa_id' => null]);
        }
    }

    public function rules(): array
    {
        $id = $this->route('productor')?->id;

        return [
            'tipo'   => ['required', Rule::in(Productor::TIPOS)],
            'nombre' => ['required', 'string', 'max:150'],
            'ci'     => ['nullable', 'required_without:nit', 'string', 'max:15',
                         Rule::unique(Productor::class, 'ci')->ignore($id)],
            'nit'    => ['nullable', 'required_without:ci', 'string', 'max:20',
                         Rule::unique(Productor::class, 'nit')->ignore($id)],
            'nim'    => ['nullable', 'string', 'max:30',
                         Rule::unique(Productor::class, 'nim')->ignore($id)],
            'telefono'  => ['nullable', 'string', 'max:20'],
            'domicilio' => ['nullable', 'string', 'max:200'],
            'cooperativa_id' => ['nullable', 'required_if:tipo,COOPERATIVISTA', 'integer',
                                 Rule::exists(Cooperativa::class, 'id')],
            'activo' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'ci.required_without'  => 'Indique el CI o el NIT del productor.',
            'nit.required_without' => 'Indique el CI o el NIT del productor.',
            'ci.unique'            => 'Ya hay un productor registrado con ese CI.',
            'nit.unique'           => 'Ya hay un productor registrado con ese NIT.',
            'nim.unique'           => 'Ya hay un productor registrado con ese NIM.',
            'cooperativa_id.required_if' => 'Un cooperativista debe pertenecer a una cooperativa.',
        ];
    }
}
