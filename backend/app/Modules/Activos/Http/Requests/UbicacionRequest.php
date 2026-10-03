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
            'codigo' => ['required', 'string', 'max:20',
                         Rule::unique('activos.ubicacion', 'codigo')->ignore($id)],
            'nombre'        => ['required', 'string', 'max:150'],
            'unidad_org_id' => ['nullable', 'integer'],
            'sucursal'      => ['nullable', 'string', 'max:100'],
            'direccion'     => ['nullable', 'string', 'max:250'],
            'ambiente'      => ['nullable', 'string', 'max:100'],
            'padre_id'      => ['nullable', 'integer', Rule::exists('activos.ubicacion', 'id'),
                                Rule::notIn([$id])],
            'activo'        => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return ['padre_id.not_in' => 'Una ubicación no puede ser padre de sí misma.'];
    }
}
