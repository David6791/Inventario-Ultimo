<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\PlantillaBascula;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Plantilla de una balanza: nombre, báscula que se guarda en el pesaje, uso
 * (interior, exterior o ambas), proporción del ticket enderezado y los
 * recuadros de cada dato en fracciones del ticket. Puede traer la foto de
 * muestra (ya enderezada) con que se dibujaron los recuadros.
 */
class PlantillaBasculaRequest extends CatalogoRequest
{
    protected function prepareForValidation(): void
    {
        $this->mayusculas('bascula');
        $this->colapsarEspacios('nombre');
        // Por multipart los recuadros llegan como texto JSON.
        if (is_string($this->input('campos'))) {
            $this->merge(['campos' => json_decode($this->input('campos'), true)]);
        }
        if ($this->has('activa')) {
            $this->merge(['activa' => filter_var($this->input('activa'), FILTER_VALIDATE_BOOLEAN)]);
        }
    }

    public function rules(): array
    {
        $id = $this->route('plantilla')?->id;

        return [
            'nombre'              => ['required', 'string', 'max:60',
                                      Rule::unique(PlantillaBascula::class, 'nombre')->ignore($id)],
            'bascula'             => ['required', 'string', 'max:40'],
            'uso'                 => ['required', Rule::in(PlantillaBascula::USOS)],
            'proporcion'          => ['required', 'numeric', 'between:0.1,10'],
            'activa'              => ['sometimes', 'boolean'],
            'campos'              => ['present', 'array', 'max:12'],
            'campos.*.campo'      => ['required', 'distinct', Rule::in(array_keys(PlantillaBascula::CAMPOS))],
            'campos.*.x'          => ['required', 'numeric', 'between:0,1'],
            'campos.*.y'          => ['required', 'numeric', 'between:0,1'],
            'campos.*.w'          => ['required', 'numeric', 'between:0.01,1'],
            'campos.*.h'          => ['required', 'numeric', 'between:0.005,1'],
            'campos.*.etiqueta'   => ['nullable', 'string', 'max:30'],
            'campos.*.decimales'  => ['nullable', 'integer', 'between:0,3'],
            'campos.*.desenfoque' => ['nullable', 'integer', 'between:0,4'],
            'campos.*.letras'     => ['nullable', 'boolean'],
            'muestra'             => ['nullable', 'file', 'mimes:jpg,jpeg,png', 'max:8192'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $v) {
            foreach ((array) $this->input('campos', []) as $i => $c) {
                if (is_array($c) && isset($c['x'], $c['w']) && $c['x'] + $c['w'] > 1.001) {
                    $v->errors()->add("campos.{$i}.w", 'El recuadro se sale del ticket por la derecha.');
                }
                if (is_array($c) && isset($c['y'], $c['h']) && $c['y'] + $c['h'] > 1.001) {
                    $v->errors()->add("campos.{$i}.h", 'El recuadro se sale del ticket por abajo.');
                }
            }
        }];
    }

    public function messages(): array
    {
        return [
            'nombre.unique'          => 'Ya hay una plantilla con ese nombre.',
            'campos.*.campo.distinct' => 'Cada dato va en un solo recuadro.',
            'muestra.max'            => 'La foto de muestra no debe pasar de 8 MB.',
        ];
    }

    /** Datos de la plantilla sin la foto, con los recuadros redondeados. */
    public function datos(): array
    {
        $d = collect($this->validated())->except('muestra')->all();
        $d['campos'] = array_map(fn ($c) => array_filter([
            'campo'      => $c['campo'],
            'x'          => round((float) $c['x'], 4),
            'y'          => round((float) $c['y'], 4),
            'w'          => round((float) $c['w'], 4),
            'h'          => round((float) $c['h'], 4),
            'etiqueta'   => isset($c['etiqueta']) ? mb_strtoupper(trim($c['etiqueta'])) ?: null : null,
            'decimales'  => isset($c['decimales']) ? (int) $c['decimales'] : null,
            'desenfoque' => isset($c['desenfoque']) ? (int) $c['desenfoque'] : null,
            'letras'     => ! empty($c['letras']) ? true : null,
        ], fn ($v) => $v !== null), $d['campos'] ?? []);

        return $d;
    }
}
