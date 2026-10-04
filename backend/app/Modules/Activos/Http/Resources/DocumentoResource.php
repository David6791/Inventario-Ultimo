<?php

namespace App\Modules\Activos\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DocumentoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'     => $this->id,
            'tipo'   => $this->tipo,
            'numero' => $this->numero,
            'gestion'=> $this->gestion,
            'fecha'  => $this->fecha?->toDateString(),
            'estado' => $this->estado,
            'motivo' => $this->motivo,
            'observaciones' => $this->observaciones,

            'custodio_origen_id'   => $this->custodio_origen_id,
            'custodio_destino_id'  => $this->custodio_destino_id,
            'ubicacion_destino_id' => $this->ubicacion_destino_id,
            'centro_costo_destino_id' => $this->centro_costo_destino_id,

            'salida' => $this->when($this->tipo === 'SALIDA_TEMPORAL', fn () => [
                'destino'             => $this->destino_externo,
                'retorno_comprometido'=> $this->fecha_retorno_comprometida?->toDateString(),
                'retorno_real'        => $this->fecha_retorno_real?->toDateString(),
                'vencido'             => $this->vencido,
            ]),

            'activos' => $this->whenLoaded('detalles', fn () => $this->detalles->map(fn ($d) => [
                'id'           => $d->activo_id,
                'codigo'       => $d->activo?->codigo,
                'denominacion' => $d->activo?->denominacion,
                'serie'        => $d->activo?->serie,
                'estado_al_emitir'    => $d->estado_verificado,
                'condicion_al_emitir' => $d->condicion_verificada,
                'observacion'  => $d->observacion,
            ])),

            'cantidad_activos' => $this->whenLoaded('detalles', fn () => $this->detalles->count()),

            'trazabilidad' => [
                'creado_por'    => $this->created_by,
                'creado_at'     => $this->created_at?->toIso8601String(),
                'confirmado_por'=> $this->confirmado_por,
                'confirmado_at' => $this->confirmado_at?->toIso8601String(),
                'anulado_por'   => $this->anulado_por,
                'anulado_at'    => $this->anulado_at?->toIso8601String(),
                'motivo_anulacion' => $this->motivo_anulacion,
            ],
        ];
    }
}
