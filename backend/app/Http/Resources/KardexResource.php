<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\MovimientoKardex */
class KardexResource extends JsonResource
{
    /** Nombre legible de cada tipo de documento que mueve existencias. */
    private const DOCUMENTOS = [
        'ingreso'                   => 'Nota de ingreso',
        'ingreso-anulacion'         => 'Anulación de ingreso',
        'salida'                    => 'Nota de salida',
        'salida-anulacion'          => 'Anulación de salida',
        'transferencia-despacho'    => 'Transferencia — despacho',
        'transferencia-recepcion'   => 'Transferencia — recepción',
        'transferencia-anulacion'   => 'Anulación de transferencia',
    ];

    public function toArray(Request $request): array
    {
        $veCostos = $request->user()?->can('stock.ver-costos') ?? false;

        return [
            'id'    => $this->id,
            'fecha' => $this->fecha?->toIso8601String(),
            'tipo'  => $this->tipo,

            'documento_tipo'     => $this->documento_tipo,
            'documento_etiqueta' => self::DOCUMENTOS[$this->documento_tipo] ?? $this->documento_tipo,
            'documento_id'       => $this->documento_id,
            'documento_numero'   => $this->documento_numero,

            'entrada' => (float) $this->entrada,
            'salida'  => (float) $this->salida,
            'saldo'   => (float) $this->saldo,

            'costo_unitario' => $veCostos ? (float) $this->costo_unitario : null,
            'costo_total'    => $veCostos ? (float) $this->costo_total : null,

            'registrado_por' => $this->whenLoaded('registradoPor', fn () => $this->registradoPor?->name),
            'observacion'    => $this->observacion,
        ];
    }
}
