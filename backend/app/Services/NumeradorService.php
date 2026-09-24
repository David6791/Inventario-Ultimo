<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Correlativos por almacén, tipo de documento y gestión.
 *
 * Usa una fila de contador con bloqueo en vez de max(numero)+1: entre el SELECT
 * y el INSERT hay una ventana en la que dos usuarios sacan el mismo número, y
 * en un almacén con varias personas cargando a la vez eso pasa de verdad.
 *
 * Debe llamarse dentro de una transacción.
 */
class NumeradorService
{
    public function siguiente(int $almacenId, string $tipo, string $prefijo, string $codigoAlmacen): string
    {
        $gestion = (int) now()->format('Y');

        $contador = DB::table('contadores_documento')
            ->where('almacen_id', $almacenId)
            ->where('tipo', $tipo)
            ->where('gestion', $gestion)
            ->lockForUpdate()
            ->first();

        if (! $contador) {
            DB::table('contadores_documento')->insert([
                'almacen_id' => $almacenId,
                'tipo'       => $tipo,
                'gestion'    => $gestion,
                'ultimo'     => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Se relee con bloqueo: entre el insert y esta línea otro proceso
            // pudo haber tomado el mismo contador.
            $contador = DB::table('contadores_documento')
                ->where('almacen_id', $almacenId)
                ->where('tipo', $tipo)
                ->where('gestion', $gestion)
                ->lockForUpdate()
                ->first();
        }

        $siguiente = $contador->ultimo + 1;

        DB::table('contadores_documento')
            ->where('id', $contador->id)
            ->update(['ultimo' => $siguiente, 'updated_at' => now()]);

        return sprintf('%s-%s-%d-%04d', $prefijo, $codigoAlmacen, $gestion, $siguiente);
    }
}
