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
                Rule::unique(\App\Modules\Activos\Models\Clase::class, 'codigo')->ignore($id),
            ],
            'nombre'   => ['required', 'string', 'max:120'],
            'deprecia' => ['required', 'boolean'],

            // required_if compara contra el string 'true' y por JSON llega un
            // booleano: nunca coincide. Rule::requiredIf evalúa el valor real.
            'vida_util_fiscal_meses' => [
                // Las condicionales van PRIMERO: `nullable` corta la cadena
                // cuando el valor es null, y el campo ausente nunca llegaría
                // a evaluarse contra requiredIf.
                Rule::requiredIf(fn () => $this->boolean('deprecia')),
                Rule::prohibitedIf(fn () => ! $this->boolean('deprecia')),
                'nullable', 'integer', 'min:1', 'max:1200',
            ],

            'coeficiente_fiscal'   => ['nullable', 'numeric', 'min:0', 'max:1'],
            'cuenta_activo'        => ['nullable', 'string', 'max:30'],
            'cuenta_dep_acumulada' => ['nullable', 'string', 'max:30'],
            'cuenta_gasto_dep'     => ['nullable', 'string', 'max:30'],
            'es_bien_control'      => ['boolean'],
            'activo'               => ['boolean'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'deprecia'        => $this->boolean('deprecia'),
            'es_bien_control' => $this->boolean('es_bien_control'),
        ]);
    }

        public function messages(): array
    {
        return [
            'codigo.regex' => 'El código debe ser de dos dígitos, por ejemplo 05.',
            'vida_util_fiscal_meses.required' =>
                'Una clase que deprecia requiere vida útil fiscal.',
            'vida_util_fiscal_meses.prohibited' =>
                'Una clase que no deprecia (terrenos) no lleva vida útil.',
        ];
    }
}
