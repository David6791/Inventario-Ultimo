<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Existencia */
class ExistenciaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $cantidad = (float) $this->cantidad;
        $minimo   = (float) ($this->producto?->stock_minimo ?? 0);
        $maximo   = $this->producto?->stock_maximo !== null
            ? (float) $this->producto->stock_maximo
            : null;

        // El costo solo lo ve quien tiene permiso: en algunas instituciones el
        // precio de compra no circula fuera del área financiera.
        $veCostos = $request->user()?->can('stock.ver-costos') ?? false;

        return [
            'id'          => $this->id,
            'producto_id' => $this->producto_id,
            'almacen_id'  => $this->almacen_id,

            'codigo'    => $this->producto?->codigo,
            'producto'  => $this->producto?->nombre,
            'categoria' => $this->producto?->categoria?->nombre,
            'unidad'    => $this->producto?->unidadMedida?->codigo,
            'almacen'   => $this->whenLoaded('almacen', fn () => $this->almacen->nombre),

            'cantidad'      => $cantidad,
            'stock_minimo'  => $minimo,
            'stock_maximo'  => $maximo,
            'estado'        => $this->estadoStock($cantidad, $minimo, $maximo),

            'costo_promedio' => $veCostos ? (float) $this->costo_promedio : null,
            'valor'          => $veCostos ? round($cantidad * (float) $this->costo_promedio, 2) : null,

            'ubicacion_fisica'     => $this->ubicacion_fisica,
            'ultimo_movimiento_en' => $this->ultimo_movimiento_en?->toIso8601String(),
        ];
    }

    /**
     * El estado que define la marca de color de la fila.
     *
     * Se calcula acá y no en el cliente para que el mismo criterio valga en la
     * pantalla, en los reportes y en el PDF.
     */
    private function estadoStock(float $cantidad, float $minimo, ?float $maximo): string
    {
        return match (true) {
            $cantidad <= 0                        => 'agotado',
            $minimo > 0 && $cantidad <= $minimo   => 'bajo',
            $maximo !== null && $cantidad > $maximo => 'exceso',
            default                               => 'normal',
        };
    }
}
