<?php

namespace Tests\Feature\Cargas;

use App\Models\User;
use Database\Seeders\CajaCargasRolesSeeder;
use Database\Seeders\CargasCatalogoSeeder;
use Database\Seeders\PermisoSeeder;
use Illuminate\Support\Facades\DB;

/**
 * Datos mínimos para las pruebas de caja y cargas.
 *
 * 05_pruebas.sql usa los usuarios 1 y 2 y el almacén 1, con esos ids. Los
 * usuarios salen de la factory; el almacén no tiene factory y se arma leyendo
 * information_schema (solo las columnas NOT NULL sin valor por defecto).
 */
trait PreparaBaseCargas
{
    protected function prepararBaseCargas(): void
    {
        $this->seed(PermisoSeeder::class);
        $this->seed(CajaCargasRolesSeeder::class);
        $this->seed(CargasCatalogoSeeder::class);

        foreach ([1, 2] as $id) {
            if (! User::query()->whereKey($id)->exists()) {
                User::factory()->create(['id' => $id]);
            }
        }
        $this->ajustarSecuencia('users');

        $this->filaConId('almacenes', 1);

        // Las pruebas anteriores a las fotos registran pesajes sin foto del ticket.
        DB::table('cargas.parametro')->where('clave', 'FOTO_TICKET_OBLIGATORIA')->update(['valor' => 'NO']);
    }

    protected function filaConId(string $tabla, int $id): void
    {
        if (DB::table($tabla)->where('id', $id)->exists()) {
            return;
        }

        $fila = ['id' => $id];
        $columnas = DB::select(
            "select column_name, data_type, column_default, is_nullable, is_generated, identity_generation
               from information_schema.columns
              where table_schema = 'public' and table_name = ?",
            [$tabla]
        );

        foreach ($columnas as $c) {
            $tieneValor = $c->is_nullable === 'YES' || $c->column_default !== null
                || $c->is_generated === 'ALWAYS' || $c->identity_generation !== null;
            if ($c->column_name === 'id' || $tieneValor) {
                continue;
            }

            $fila[$c->column_name] = match (true) {
                in_array($c->data_type, ['smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision'], true) => 0,
                $c->data_type === 'boolean' => false,
                str_starts_with($c->data_type, 'timestamp') || $c->data_type === 'date' => now(),
                $c->column_name === 'email' => "prueba{$id}@{$tabla}.local",
                $c->column_name === 'password' => bcrypt('no-se-usa'),
                default => "prueba-{$tabla}-{$id}",
            };
        }

        DB::table($tabla)->insert($fila);
        $this->ajustarSecuencia($tabla);
    }

    /** Que el próximo id automático no choque con los ids que forzamos. */
    protected function ajustarSecuencia(string $tabla): void
    {
        DB::statement(
            "select setval(pg_get_serial_sequence(?, 'id'), greatest((select max(id) from {$tabla}), 1))",
            ["public.{$tabla}"]
        );
    }
}
