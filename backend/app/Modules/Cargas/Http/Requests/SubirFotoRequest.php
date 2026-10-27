<?php

namespace App\Modules\Cargas\Http\Requests;

use App\Modules\Cargas\Models\PlantillaBascula;
use App\Modules\Cargas\Models\RecepcionFoto;
use Illuminate\Validation\Rule;

/**
 * Foto de un ticket o de la balanza manual. «imagen» es la foto enderezada
 * (la que se lee); «original», la foto tal como salió de la cámara.
 */
class SubirFotoRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.recibir';

    public function rules(): array
    {
        return [
            'tipo'         => ['required', Rule::in(RecepcionFoto::TIPOS)],
            'imagen'       => ['required', 'file', 'mimes:jpg,jpeg,png', 'max:8192'],
            'original'     => ['nullable', 'file', 'mimes:jpg,jpeg,png', 'max:12288'],
            'plantilla_id' => ['nullable', 'integer', 'prohibited_if:tipo,BALANZA_MANUAL',
                               Rule::exists(PlantillaBascula::class, 'id')->where('activa', true)],
        ];
    }

    public function messages(): array
    {
        return [
            'imagen.required'      => 'Tome o elija la foto.',
            'imagen.mimes'         => 'La foto debe ser JPG o PNG.',
            'imagen.max'           => 'La foto no debe pasar de 8 MB.',
            'plantilla_id.exists'  => 'La plantilla de báscula no existe o está inactiva.',
        ];
    }
}
