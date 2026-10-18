<?php

namespace App\Modules\Cargas\Services;

use App\Modules\Cargas\Models\Parametro;
use App\Modules\Comun\Support\Transaccion;

/**
 * Parámetros con historia. Cambiar un valor no lo pisa: cierra el vigente el
 * día anterior al nuevo y abre otro. Así se puede saber qué valor regía en
 * cualquier fecha (por ejemplo, la sigla con la que se numeró un lote).
 */
class ParametroService
{
    public function vigente(string $clave, ?string $fecha = null): ?Parametro
    {
        return Parametro::vigenteEl($clave, $fecha ?? now()->toDateString())->first();
    }

    public function cambiar(string $clave, string $valor, ?string $desde = null, string $tipoDato = 'texto', ?string $descripcion = null): Parametro
    {
        $desde ??= now()->toDateString();

        return Transaccion::delUsuarioActual(function () use ($clave, $valor, $desde, $tipoDato, $descripcion) {
            $actual = Parametro::vigenteEl($clave, $desde)->lockForUpdate()->first();

            if ($actual && $actual->valor === $valor) {
                return $actual;
            }

            // Cambio el mismo día en que empezó a regir: se corrige, no se versiona.
            if ($actual && $actual->vigente_desde->toDateString() === $desde) {
                $actual->update(['valor' => $valor]);

                return $actual->refresh();
            }

            $actual?->update(['vigente_hasta' => $desde]);

            return Parametro::create([
                'clave'         => $clave,
                'valor'         => $valor,
                'tipo_dato'     => $actual->tipo_dato ?? $tipoDato,
                'descripcion'   => $actual->descripcion ?? $descripcion,
                'vigente_desde' => $desde,
            ]);
        });
    }
}
