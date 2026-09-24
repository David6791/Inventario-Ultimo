<?php

namespace Database\Seeders;

use App\Enums\Permisos;
use App\Services\VersionPermisosService;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;

/**
 * Idempotente: se ejecuta en cada despliegue sin duplicar nada.
 * Los permisos son parte del código, no datos que edite el usuario.
 */
class PermisoSeeder extends Seeder
{
    public function run(): void
    {
        $catalogo = Permisos::todos();

        foreach ($catalogo as $nombre) {
            Permission::findOrCreate($nombre, 'sanctum');
        }

        // Limpia permisos que se quitaron del catálogo al refactorizar el código.
        // syncPermissions de los roles los suelta solo; esto borra el huérfano.
        Permission::where('guard_name', 'sanctum')
            ->whereNotIn('name', $catalogo)
            ->delete();

        app(VersionPermisosService::class)->invalidar();

        $this->command?->info('Permisos sincronizados: '.count($catalogo));
    }
}
