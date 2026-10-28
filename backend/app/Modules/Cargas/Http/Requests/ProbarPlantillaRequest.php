<?php

namespace App\Modules\Cargas\Http\Requests;

/** Probar los recuadros de una plantilla sobre una foto, sin guardar nada. */
class ProbarPlantillaRequest extends PlantillaBasculaRequest
{
    public function rules(): array
    {
        $r = parent::rules();

        return [
            'imagen' => ['required', 'file', 'mimes:jpg,jpeg,png', 'max:8192'],
            'lector' => ['nullable', \Illuminate\Validation\Rule::in(\App\Modules\Cargas\Services\FotoRecepcionService::LECTORES)],
            ...collect($r)->only(['campos', 'campos.*.campo', 'campos.*.x', 'campos.*.y', 'campos.*.w', 'campos.*.h',
                                   'campos.*.etiqueta', 'campos.*.decimales', 'campos.*.desenfoque', 'campos.*.letras'])->all(),
        ];
    }
}
