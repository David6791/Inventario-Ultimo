<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Salida */
class SalidaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'     => $this->id,
            'numero' => $this->numero,
            'fecha'  => $this->fecha?->toDateString(),

            'almacen_id' => $this->almacen_id,
            'almacen'    => $this->whenLoaded('almacen', fn () => $this->almacen->nombre),

            // El texto es lo que se muestra: es la foto del momento en que se
            // firmó. Los identificadores sirven para precargar el formulario y
            // para agrupar en reportes.
            'unidad_solicitante' => $this->unidad_solicitante,
            'solicitante'        => $this->solicitante,
            'recibido_por'       => $this->recibido_por,

            'unidad_solicitante_id' => $this->unidad_solicitante_id,
            'solicitante_id'        => $this->solicitante_id,
            'recibido_por_id'       => $this->recibido_por_id,
            'centro_costo'       => $this->centro_costo,
            'destino'            => $this->destino,
            'motivo'             => $this->motivo,

            'estado'          => $this->estado->value,
            'estado_etiqueta' => $this->estado->etiqueta(),
            'editable'        => $this->estado->esEditable(),

            'tiene_respaldo'     => $this->tieneRespaldo(),
            'respaldo_nombre'    => $this->respaldo_nombre,
            'respaldo_subido_en' => $this->respaldo_subido_en?->toIso8601String(),

            'confirmada_en'  => $this->confirmada_en?->toIso8601String(),
            'registrado_por' => $this->whenLoaded('registradoPor', fn () => $this->registradoPor->name),
            'confirmada_por' => $this->whenLoaded('confirmadaPor', fn () => $this->confirmadaPor?->name),

            'motivo_anulacion' => $this->motivo_anulacion,
            'anulada_en'       => $this->anulada_en?->toIso8601String(),

            'detalles' => $this->whenLoaded('detalles', fn () => $this->detalles->map(fn ($d) => [
                'id'          => $d->id,
                'producto_id' => $d->producto_id,
                'codigo'      => $d->relationLoaded('producto') ? $d->producto->codigo : null,
                'producto'    => $d->relationLoaded('producto') ? $d->producto->nombre : null,
                'unidad'      => $d->relationLoaded('producto') && $d->producto->relationLoaded('unidadMedida')
                    ? $d->producto->unidadMedida->codigo : null,
                'cantidad'       => (float) $d->cantidad,
                'costo_unitario' => (float) $d->costo_unitario,
                'observacion'    => $d->observacion,
            ])),

            'lineas'    => $this->whenCounted('detalles'),
            'creado_en' => $this->created_at?->toIso8601String(),
        ];
    }
}
