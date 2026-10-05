<?php

namespace App\Modules\Activos\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SubclaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('activos-config.administrar') ?? false;
    }

    public function rules(): array
    {
        $id = $this->route('subclase')?->id;

        return [
            'clase_id' => ['required', 'integer', Rule::exists(\App\Modules\Activos\Models\Clase::class, 'id')],
            'codigo'   => [
                'required', 'string', 'size:2', 'regex:/^[0-9]{2}$/',
                Rule::unique(\App\Modules\Activos\Models\Subclase::class, 'codigo')
                    ->where(fn ($q) => $q->where('clase_id', $this->input('clase_id')))
                    ->ignore($id),
            ],
            'nombre'                    => ['required', 'string', 'max:120'],
            'vida_util_economica_meses' => ['nullable', 'integer', 'min:1', 'max:1200'],
            'activo'                    => ['boolean'],
        ];
    }
}
