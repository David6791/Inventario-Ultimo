<?php

namespace App\Modules\Activos\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UbicacionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('activos-config.administrar') ?? false;
    }

    public function rules(): array
    {
        $id = $this->route('ubicacion')?->id;

        return [
            'codigo'   => ['required', 'string', 'max:20',
                           Rule::unique(\App\Modules\Activos\Models\Ubicacion::class, 'codigo')->ignore($id)],
            'padre_id' => ['nullable', 'integer',
                           Rule::exists(\App\Modules\Activos\Models\Ubicacion::class, 'id'),
                           Rule::notIn([$id])],
            'nombre'        => ['required', 'string', 'max:150'],
            'unidad_org_id' => ['nullable', 'integer'],
            'sucursal'      => ['nullable', 'string', 'max:100'],
            'direccion'     => ['nullable', 'string', 'max:250'],
            'ambiente'      => ['nullable', 'string', 'max:100'],
            'activo'        => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return ['padre_id.not_in' => 'Una ubicación no puede ser padre de sí misma.'];
    }
}
