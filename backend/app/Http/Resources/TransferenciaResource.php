<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Transferencia */
class TransferenciaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $usuario = $request->user();

        return [
            'id'     => $this->id,
            'numero' => $this->numero,
            'fecha'  => $this->fecha?->toDateString(),

            'almacen_origen_id'  => $this->almacen_origen_id,
            'almacen_destino_id' => $this->almacen_destino_id,
            'origen'  => $this->whenLoaded('origen', fn () => $this->origen->nombre),
            'destino' => $this->whenLoaded('destino', fn () => $this->destino->nombre),

            'motivo'        => $this->motivo,
            'transportista' => $this->transportista,

            'estado'          => $this->estado->value,
            'estado_etiqueta' => $this->estado->etiqueta(),
            'editable'        => $this->estado->esEditable(),
            'en_transito'     => $this->estado->enTransito(),

            /*
            | Qué puede hacer ESTE usuario con ESTE documento.
            |
            | Se resuelve en el servidor porque depende de a qué almacén está
            | asignado: despacha quien está en el origen, recibe quien está en
            | el destino. El frontend no tiene por qué replicar esa regla.
            */
            'puede_despachar' => $usuario
                ? $usuario->can('transferencias.confirmar')
                    && $usuario->accedeAlmacen($this->almacen_origen_id)
                : false,
            'puede_recibir' => $usuario
                ? $usuario->can('transferencias.confirmar')
                    && $usuario->accedeAlmacen($this->almacen_destino_id)
                : false,

            'despachada_en'  => $this->despachada_en?->toIso8601String(),
            'despachada_por' => $this->whenLoaded('despachadaPor', fn () => $this->despachadaPor?->name),
            'recibida_en'    => $this->recibida_en?->toIso8601String(),
            'recibida_por'   => $this->whenLoaded('recibidaPor', fn () => $this->recibidaPor?->name),
            'observacion_recepcion' => $this->observacion_recepcion,

            'motivo_anulacion' => $this->motivo_anulacion,
            'anulada_en'       => $this->anulada_en?->toIso8601String(),
            'registrado_por'   => $this->whenLoaded('registradoPor', fn () => $this->registradoPor->name),

            'detalles' => $this->whenLoaded('detalles', fn () => $this->detalles->map(fn ($d) => [
                'id'          => $d->id,
                'producto_id' => $d->producto_id,
                'codigo'      => $d->relationLoaded('producto') ? $d->producto->codigo : null,
                'producto'    => $d->relationLoaded('producto') ? $d->producto->nombre : null,
                'unidad'      => $d->relationLoaded('producto') && $d->producto->relationLoaded('unidadMedida')
                    ? $d->producto->unidadMedida->codigo : null,
                'permite_decimales' => $d->relationLoaded('producto') && $d->producto->relationLoaded('unidadMedida')
                    ? (bool) $d->producto->unidadMedida->permite_decimales : false,
                'cantidad'          => (float) $d->cantidad,
                'cantidad_recibida' => $d->cantidad_recibida !== null ? (float) $d->cantidad_recibida : null,
                'faltante'          => $d->faltante(),
                'observacion'       => $d->observacion,
            ])),

            'tiene_faltantes' => $this->whenLoaded('detalles', fn () => $this->tieneFaltantes()),
            'lineas'          => $this->whenCounted('detalles'),
            'creado_en'       => $this->created_at?->toIso8601String(),
        ];
    }
}
