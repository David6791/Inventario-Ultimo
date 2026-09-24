<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /** El orden importa: permisos, luego roles, luego usuarios. */
    public function run(): void
    {
        $this->call([
            PermisoSeeder::class,
            RolSeeder::class,
            AlmacenSeeder::class,
            UsuarioSeeder::class,
            CatalogoSeeder::class,
        ]);
    }
}
