<?php

namespace App\Modules\Comun\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Nombre, detalle, logo y marca de agua de documentos y reportes. */
class EmpresaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('empresa.configurar') ?? false;
    }

    protected function prepareForValidation(): void
    {
        foreach (['nombre', 'subtitulo'] as $campo) {
            if (is_string($this->input($campo))) {
                $valor = preg_replace('/\s+/u', ' ', trim($this->input($campo)));
                $this->merge([$campo => $valor === '' ? null : $valor]);
            }
        }
    }

    public function rules(): array
    {
        return [
            'nombre'              => ['required', 'string', 'max:120'],
            'subtitulo'           => ['nullable', 'string', 'max:200'],
            'marca_agua_opacidad' => ['nullable', 'numeric', 'between:0.02,0.5'],
            'logo'                => ['nullable', 'file', 'mimes:png,jpg,jpeg', 'max:1024'],
            'marca_agua'          => ['nullable', 'file', 'mimes:png,jpg,jpeg', 'max:2048'],
            'quitar_logo'         => ['nullable', 'boolean'],
            'quitar_marca_agua'   => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required'      => 'Escriba el nombre de la empresa.',
            'logo.mimes'           => 'El logo debe ser una imagen PNG o JPG.',
            'logo.max'             => 'El logo pesa demasiado: como máximo 1 MB.',
            'marca_agua.mimes'     => 'La marca de agua debe ser una imagen PNG o JPG.',
            'marca_agua.max'       => 'La marca de agua pesa demasiado: como máximo 2 MB.',
            'marca_agua_opacidad.between' => 'La intensidad de la marca de agua va de 2 % a 50 %.',
        ];
    }
}
