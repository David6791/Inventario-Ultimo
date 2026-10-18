<?php

namespace App\Modules\Cargas\Http\Requests;

class CertificadoRequest extends CatalogoRequest
{
    protected string $permiso = 'cargas.cargar-analisis';

    public function rules(): array
    {
        return ['archivo' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240']];
    }

    public function messages(): array
    {
        return [
            'archivo.required' => 'Elija el archivo del certificado.',
            'archivo.mimes'    => 'El certificado debe ser PDF, JPG o PNG.',
            'archivo.max'      => 'El certificado no puede pasar de 10 MB.',
        ];
    }
}
