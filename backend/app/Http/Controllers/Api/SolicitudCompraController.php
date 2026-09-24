<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\SolicitudCompraRequest;
use App\Http\Resources\SolicitudCompraResource;
use App\Models\SolicitudCompra;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Solicitudes de compra: piden material que entrará al almacén.
 *
 * Todo el ciclo de vida vive en la clase base. Acá solo se declara qué modelo,
 * qué permiso y qué campos propios maneja este tipo.
 */
class SolicitudCompraController extends SolicitudBaseController
{
    protected function modelo(): string
    {
        return SolicitudCompra::class;
    }

    protected function recurso(): string
    {
        return SolicitudCompraResource::class;
    }

    protected function permisoRegistro(): string
    {
        return 'solicitudes.registrar';
    }

    protected function rutaBase(): string
    {
        return 'solicitudes-compra';
    }

    protected function vistaPdf(): string
    {
        return 'pdf.solicitud-compra';
    }

    protected function camposPropios(Request $request): array
    {
        return [
            'partida_presupuestaria' => $request->input('partida_presupuestaria'),
            'monto_estimado'         => $request->input('monto_estimado'),
        ];
    }

    /*
    | Se redeclaran store y update solo para atar el FormRequest correcto.
    | La lógica sigue siendo la de la clase base.
    */
    public function store(Request $request): JsonResponse
    {
        return parent::store(app(SolicitudCompraRequest::class));
    }

    public function update(Request $request, int|string $id): JsonResource
    {
        return parent::update(app(SolicitudCompraRequest::class), $id);
    }
}
