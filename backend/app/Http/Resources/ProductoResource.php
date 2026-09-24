<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Producto */
class ProductoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'codigo'      => $this->codigo,
            'nombre'      => $this->nombre,
            'descripcion' => $this->descripcion,

            'categoria_id'     => $this->categoria_id,
            'unidad_medida_id' => $this->unidad_medida_id,

            // Se envían planos para que la tabla no tenga que navegar objetos
            // anidados en cada fila.
            'categoria' => $this->whenLoaded('categoria', fn () => $this->categoria->nombre),
            'unidad'    => $this->whenLoaded('unidadMedida', fn () => $this->unidadMedida->codigo),
            'permite_decimales' => $this->whenLoaded(
                'unidadMedida',
                fn () => (bool) $this->unidadMedida->permite_decimales
            ),

            'partida_presupuestaria' => $this->partida_presupuestaria,
            'codigo_barras'          => $this->codigo_barras,

            'stock_minimo' => (float) $this->stock_minimo,
            'stock_maximo' => $this->stock_maximo !== null ? (float) $this->stock_maximo : null,

            'controla_lote'        => (bool) $this->controla_lote,
            'controla_vencimiento' => (bool) $this->controla_vencimiento,
            'activo'               => (bool) $this->activo,
        ];
    }
}
