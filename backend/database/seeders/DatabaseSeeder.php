<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * El orden importa: permisos, luego roles, luego usuarios.
     *
     * Todo lo que corre aquí es estructura e idempotente: volver a correr
     * `php artisan db:seed` no duplica nada. Los datos de demostración
     * (ActivosSeeder) van aparte.
     */
    public function run(): void
    {
        $this->call([
            PermisoSeeder::class,
            RolSeeder::class,
            ActivosRolesSeeder::class,
            CajaCargasRolesSeeder::class,
            AlmacenSeeder::class,
            UsuarioSeeder::class,
            CatalogoSeeder::class,
            CargasCatalogoSeeder::class,
        ]);
    }
}
