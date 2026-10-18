<?php

namespace App\Modules\Comun\Support;

use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Transacción con el usuario identificado ante la base.
 *
 * Varias reglas del modelo registran quién hizo el cambio (por ejemplo, la
 * bitácora de estados del lote) leyendo cargas.usuario_id. Sin este dato la
 * base rechaza el cambio de estado con «Falta identificar al usuario».
 *
 *   Transaccion::delUsuarioActual(fn () => $servicio->muestrear($lote));
 *
 * Las reglas diferidas (por ejemplo, que un egreso de anticipo quede vinculado
 * a su anticipo) se verifican al confirmar: si fallan, la excepción sale del
 * propio Transaccion::como() y no se guarda nada.
 */
final class Transaccion
{
    public static function como(int|string|null $usuarioId, callable $trabajo, int $intentos = 1): mixed
    {
        if ($usuarioId === null || $usuarioId === '' || ! ctype_digit((string) $usuarioId)) {
            throw new LogicException('Transaccion::como() necesita el id del usuario que hace el cambio.');
        }

        return DB::transaction(function () use ($usuarioId, $trabajo) {
            // is_local = true: vale solo hasta el fin de esta transacción.
            DB::select("select set_config('cargas.usuario_id', ?, true)", [(string) $usuarioId]);

            return $trabajo();
        }, $intentos);
    }

    public static function delUsuarioActual(callable $trabajo, int $intentos = 1): mixed
    {
        return self::como(auth()->id(), $trabajo, $intentos);
    }
}
