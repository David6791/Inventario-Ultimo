<?php

namespace App\Modules\Activos\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ClaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('activos-config.administrar') ?? false;
    }

    public function rules(): array
    {
        $id = $this->route('clase')?->id;

        return [
            'codigo' => [
                'required', 'string', 'size:2', 'regex:/^[0-9]{2}$/',
                Rule::unique('activos.clase', 'codigo')->ignore($id),
            ],
            'nombre'                 => ['required', 'string', 'max:120'],
            'deprecia'               => ['required', 'boolean'],
            'vida_util_fiscal_meses' => ['nullable', 'integer', 'min:1', 'max:1200',
                                         'required_if:deprecia,true', 'prohibited_if:deprecia,false'],
            'coeficiente_fiscal'     => ['nullable', 'numeric', 'min:0', 'max:1'],
            'cuenta_activo'          => ['nullable', 'string', 'max:30'],
            'cuenta_dep_acumulada'   => ['nullable', 'string', 'max:30'],
            'cuenta_gasto_dep'       => ['nullable', 'string', 'max:30'],
            'es_bien_control'        => ['boolean'],
            'activo'                 => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'codigo.regex'                       => 'El código debe ser de dos dígitos, por ejemplo 05.',
            'vida_util_fiscal_meses.required_if' => 'Una clase que deprecia requiere vida útil fiscal.',
            'vida_util_fiscal_meses.prohibited_if' => 'Una clase que no deprecia (terrenos) no lleva vida útil.',
        ];
    }
}
