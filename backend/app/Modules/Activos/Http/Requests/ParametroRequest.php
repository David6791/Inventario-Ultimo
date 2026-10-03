<?php

namespace App\Modules\Activos\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ParametroRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('activos-config.administrar') ?? false;
    }

    public function rules(): array
    {
        return [
            'valor'         => ['required', 'string', 'max:200'],
            'vigente_desde' => ['required', 'date', 'after:today'],
            'descripcion'   => ['nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'vigente_desde.after' => 'La nueva vigencia debe iniciar a futuro, para no alterar períodos ya calculados.',
        ];
    }
}
