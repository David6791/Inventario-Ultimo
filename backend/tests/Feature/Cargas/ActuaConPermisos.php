<?php

namespace Tests\Feature\Cargas;

use App\Models\User;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;

/** Usuarios con permisos puntuales y un lote mínimo para probar candados. */
trait ActuaConPermisos
{
    protected function actuarCon(array $permisos): User
    {
        $usuario = User::factory()->create();
        $usuario->givePermissionTo($permisos);
        Sanctum::actingAs($usuario);

        return $usuario;
    }

    /** Lote de compra recibido en la serie indicada (lo numera la base). */
    protected function crearLote(string $prefijo, int $productorId, ?int $minaId = null): string
    {
        return Transaccion::como(1, function () use ($prefijo, $productorId, $minaId) {
            DB::insert(
                'insert into cargas.lote (serie_id, almacen_id, productor_id, mina_id, registrado_por)
                 select id, 1, ?, ?, 1 from cargas.serie_lote where prefijo = ?',
                [$productorId, $minaId, $prefijo]
            );

            return DB::selectOne('select codigo from cargas.lote order by id desc limit 1')->codigo;
        });
    }
}
