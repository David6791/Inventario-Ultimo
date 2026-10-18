<?php

namespace App\Modules\Cargas\Services;

use App\Modules\Cargas\Models\LineaProducto;
use App\Modules\Comun\Support\Transaccion;

/** Línea de producto y sus elementos se guardan juntos, en una sola transacción. */
class LineaProductoService
{
    public function guardar(array $datos, ?LineaProducto $linea = null): LineaProducto
    {
        return Transaccion::delUsuarioActual(function () use ($datos, $linea) {
            $elementos = collect($datos['elementos'])->keyBy('elemento_id');
            unset($datos['elementos']);

            if ($linea) {
                $linea->update($datos);
            } else {
                $linea = LineaProducto::create($datos);
            }

            // Sincroniza: borra los que salieron, actualiza los que siguen, crea los nuevos.
            $linea->elementos()->whereNotIn('elemento_id', $elementos->keys())->delete();

            foreach ($elementos as $elementoId => $fila) {
                $linea->elementos()->updateOrCreate(
                    ['elemento_id' => $elementoId],
                    ['rol' => $fila['rol'], 'split_limit' => $fila['split_limit'] ?? null]
                );
            }

            return $linea->load('elementos.elemento');
        });
    }
}
