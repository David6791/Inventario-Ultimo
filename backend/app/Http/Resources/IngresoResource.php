<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Ingreso */
class IngresoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'     => $this->id,
            'numero' => $this->numero,
            'fecha'  => $this->fecha?->toDateString(),

            'almacen_id' => $this->almacen_id,
            'almacen'    => $this->whenLoaded('almacen', fn () => $this->almacen->nombre),

            'solicitud_compra_id' => $this->solicitud_compra_id,
            'solicitud_numero'    => $this->whenLoaded('solicitud', fn () => $this->solicitud->numero),

            'proveedor'        => $this->proveedor,
            'tipo_documento'   => $this->tipo_documento,
            'numero_documento' => $this->numero_documento,
            'fecha_documento'  => $this->fecha_documento?->toDateString(),
            'observaciones'    => $this->observaciones,

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
                'solicitud_compra_detalle_id' => $d->solicitud_compra_detalle_id,
                'codigo'      => $d->relationLoaded('producto') ? $d->producto->codigo : null,
                'producto'    => $d->relationLoaded('producto') ? $d->producto->nombre : null,
                'unidad'      => $d->relationLoaded('producto') && $d->producto->relationLoaded('unidadMedida')
                    ? $d->producto->unidadMedida->codigo : null,
                'cantidad'          => (float) $d->cantidad,
                'costo_unitario'    => (float) $d->costo_unitario,
                'importe'           => $d->importe(),
                'lote'              => $d->lote,
                'fecha_vencimiento' => $d->fecha_vencimiento?->toDateString(),
                'observacion'       => $d->observacion,
            ])),

            'valor_total' => $this->whenLoaded('detalles', fn () => $this->valorTotal()),
            'lineas'      => $this->whenCounted('detalles'),
            'creado_en'   => $this->created_at?->toIso8601String(),
        ];
    }
}
