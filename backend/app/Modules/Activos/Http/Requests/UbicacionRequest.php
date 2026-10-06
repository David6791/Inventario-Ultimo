<?php

namespace App\Modules\Activos\Http\Requests;

use App\Modules\Activos\Models\CentroCosto;
use App\Modules\Activos\Models\Ubicacion;
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
                         Rule::unique(Ubicacion::class, 'codigo')->ignore($id)],
            'nombre' => ['required', 'string', 'max:150'],

            'padre_id' => ['nullable', 'integer',
                           Rule::exists(Ubicacion::class, 'id'),
                           Rule::notIn([$id])],

            // El centro define a qué parte de la empresa pertenece la
            // ubicación, y de ahí sale la visibilidad. Obligatorio en raíces;
            // las hijas lo heredan del padre.
            'centro_costo_id' => [
                Rule::requiredIf(fn () => blank($this->input('padre_id'))),
                'nullable', 'integer', Rule::exists(CentroCosto::class, 'id'),
            ],

            'unidad_org_id' => ['nullable', 'integer'],
            'sucursal'      => ['nullable', 'string', 'max:100'],
            'direccion'     => ['nullable', 'string', 'max:250'],
            'ambiente'      => ['nullable', 'string', 'max:100'],
            'activo'        => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'padre_id.not_in' => 'Una ubicación no puede ser padre de sí misma.',
            'centro_costo_id.required' =>
                'Una ubicación raíz requiere centro de costo: es lo que define a qué parte '
                .'de la empresa pertenecen los bienes que están ahí. Las hijas lo heredan.',
        ];
    }
}
