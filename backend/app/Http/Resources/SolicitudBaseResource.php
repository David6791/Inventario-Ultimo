<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Campos comunes de cualquier solicitud. Cada tipo agrega los suyos. */
abstract class SolicitudBaseResource extends JsonResource
{
    /** Segmento de la API, para armar la URL del documento. */
    abstract protected function rutaBase(): string;

    /** Identificador del tipo, que el frontend usa para elegir pantalla. */
    abstract protected function tipo(): string;

    abstract protected function etiquetaTipo(): string;

    /** Campos propios del tipo. */
    abstract protected function camposPropios(): array;

    public function toArray(Request $request): array
    {
        return array_merge([
            'id'     => $this->id,
            'tipo'   => $this->tipo(),
            'tipo_etiqueta' => $this->etiquetaTipo(),
            'numero' => $this->numero,
            'fecha'  => $this->fecha?->toDateString(),

            'almacen_id' => $this->almacen_id,
            'almacen'    => $this->whenLoaded('almacen', fn () => $this->almacen->nombre),

            'unidad_solicitante' => $this->unidad_solicitante,
            'solicitante'        => $this->solicitante,
            'justificacion'      => $this->justificacion,
            'observaciones'      => $this->observaciones,

            'estado'          => $this->estado->value,
            'estado_etiqueta' => $this->estado->etiqueta(),
            'editable'        => $this->estado->esEditable(),
            'admite_atencion' => $this->estado->admiteAtencion(),

            'documento_nombre' => $this->documento_nombre,
            'documento_url'    => $this->documento_ruta
                ? url("/api/{$this->rutaBase()}/{$this->id}/documento")
                : null,
            'fecha_aprobacion'       => $this->fecha_aprobacion?->toDateString(),
            'observacion_aprobacion' => $this->observacion_aprobacion,

            'registrado_por' => $this->whenLoaded('registradoPor', fn () => $this->registradoPor->name),
            'aprobado_por'   => $this->whenLoaded('aprobadoPor', fn () => $this->aprobadoPor?->name),

            'detalles' => $this->whenLoaded('detalles', fn () => $this->detalles->map(fn ($d) => [
                'id'          => $d->id,
                'producto_id' => $d->producto_id,
                'codigo'      => $d->relationLoaded('producto') ? $d->producto->codigo : null,
                'producto'    => $d->relationLoaded('producto') ? $d->producto->nombre : null,
                'unidad'      => $d->relationLoaded('producto') && $d->producto->relationLoaded('unidadMedida')
                    ? $d->producto->unidadMedida->codigo : null,
                'cantidad'          => (float) $d->cantidad,
                'cantidad_atendida' => (float) $d->cantidad_atendida,
                'saldo'             => $d->saldo(),
                'especificacion'    => $d->especificacion,
            ])),

            'lineas'    => $this->whenCounted('detalles'),
            'creado_en' => $this->created_at?->toIso8601String(),
        ], $this->camposPropios());
    }
}
