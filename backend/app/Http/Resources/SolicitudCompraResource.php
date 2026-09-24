<?php

namespace App\Http\Resources;

/** @mixin \App\Models\SolicitudCompra */
class SolicitudCompraResource extends SolicitudBaseResource
{
    protected function rutaBase(): string
    {
        return 'solicitudes-compra';
    }

    protected function tipo(): string
    {
        return 'compra';
    }

    protected function etiquetaTipo(): string
    {
        return 'Solicitud de compra';
    }

    protected function camposPropios(): array
    {
        return [
            'partida_presupuestaria' => $this->partida_presupuestaria,
            'monto_estimado' => $this->monto_estimado !== null
                ? (float) $this->monto_estimado
                : null,
        ];
    }
}
