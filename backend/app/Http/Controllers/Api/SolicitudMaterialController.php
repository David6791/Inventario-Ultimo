<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\SolicitudMaterialRequest;
use App\Http\Resources\SolicitudMaterialResource;
use App\Models\Existencia;
use App\Models\SolicitudMaterial;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Solicitudes de material: piden material que saldrá del almacén. */
class SolicitudMaterialController extends SolicitudBaseController
{
    protected function modelo(): string
    {
        return SolicitudMaterial::class;
    }

    protected function recurso(): string
    {
        return SolicitudMaterialResource::class;
    }

    protected function permisoRegistro(): string
    {
        return 'solicitudes.registrar-material';
    }

    protected function rutaBase(): string
    {
        return 'solicitudes-material';
    }

    protected function vistaPdf(): string
    {
        return 'pdf.solicitud-material';
    }

    /**
     * Antes de aprobar, verifica que todavía haya existencias.
     *
     * Entre el registro y la aprobación pueden haber pasado días. Como no hay
     * reserva, otra persona pudo llevarse el material; aprobar igual solo
     * traslada el problema al momento de despachar, cuando ya hay una firma de
     * por medio.
     */
    protected function verificarAntesDeAprobar(Model $solicitud): void
    {
        $lineas = $solicitud->detalles()->with('producto:id,nombre')->get();

        $saldos = Existencia::disponibles(
            $lineas->pluck('producto_id')->all(),
            $solicitud->almacen_id,
        );

        $faltantes = $lineas
            ->filter(fn ($d) => (float) $d->cantidad > ($saldos[$d->producto_id] ?? 0))
            ->map(function ($d) use ($saldos) {
                $hay = $saldos[$d->producto_id] ?? 0;
                return "{$d->producto->nombre} (pide {$d->cantidad}, hay {$hay})";
            });

        abort_if(
            $faltantes->isNotEmpty(),
            409,
            'Ya no hay existencias suficientes: '.$faltantes->implode('; ')
            .'. Ajuste la solicitud o registre primero el ingreso correspondiente.'
        );
    }

    protected function camposPropios(Request $request): array
    {
        return [
            'centro_costo' => $request->input('centro_costo'),
            'destino'      => $request->input('destino'),
        ];
    }

    public function store(Request $request): JsonResponse
    {
        return parent::store(app(SolicitudMaterialRequest::class));
    }

    public function update(Request $request, int $id): JsonResource
    {
        return parent::update(app(SolicitudMaterialRequest::class), $id);
    }
}
