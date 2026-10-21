<?php

namespace App\Modules\Caja\Http\Requests;

/** Aprobar (observación opcional) o rechazar (motivo obligatorio) una solicitud. */
class ResolverSolicitudRequest extends FormularioCaja
{
    protected string $permiso = 'caja.aprobar';

    protected function prepareForValidation(): void
    {
        $this->colapsarEspacios('observacion');
    }

    public function rules(): array
    {
        $rechazo = str_ends_with($this->path(), '/rechazar');

        return ['observacion' => [$rechazo ? 'required' : 'nullable', 'string', $rechazo ? 'min:5' : 'min:0', 'max:250']];
    }

    public function messages(): array
    {
        return [
            'observacion.required' => 'Indique por qué se rechaza la solicitud.',
            'observacion.min'      => 'Explique el motivo del rechazo con un poco más de detalle.',
        ];
    }
}
