<?php

namespace App\Modules\Cargas\Services;

use App\Models\User;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Support\Facades\DB;

/** Publica una tabla de tramos del bono: la vigente se cierra donde empieza la nueva (lo hace la base). */
class BonoTramoService
{
    public function publicar(string $vigenteDesde, array $tramos, User $usuario): int
    {
        return Transaccion::como($usuario->id, fn () => (int) DB::selectOne(
            'select cargas.publicar_tramos_bono(?::date, ?::jsonb, ?) as n',
            [$vigenteDesde, json_encode(array_values($tramos)), $usuario->id]
        )->n);
    }
}
