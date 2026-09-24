<?php

namespace App\Http\Resources;

/** @mixin \App\Models\SolicitudMaterial */
class SolicitudMaterialResource extends SolicitudBaseResource
{
    protected function rutaBase(): string
    {
        return 'solicitudes-material';
    }

    protected function tipo(): string
    {
        return 'material';
    }

    protected function etiquetaTipo(): string
    {
        return 'Solicitud de material';
    }

    protected function camposPropios(): array
    {
        return [
            'centro_costo' => $this->centro_costo,
            'destino'      => $this->destino,
        ];
    }
}
