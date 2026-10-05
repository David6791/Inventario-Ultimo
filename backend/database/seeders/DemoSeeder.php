<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\PermissionRegistrar;

/**
 * Usuario de demostración del módulo de activos fijos.
 *
 *   php artisan db:seed --class=DemoSeeder
 *
 * Existe porque cada `docker compose down -v` borra la base y recrear el
 * usuario a mano con sus roles y permisos toma quince minutos de tinker.
 *
 * NO EJECUTAR EN PRODUCCIÓN: crea un usuario con contraseña conocida.
 */
class DemoSeeder extends Seeder
{
    private const EMAIL = 'demo@activos.test';
    private const CLAVE = 'demo1234';

    private const ROLES = ['Encargado de Activos Fijos'];

    /** Permisos sueltos que el rol no incluye pero la demo necesita. */
    private const PERMISOS_EXTRA = [
        'dashboard.ver',                        // sin esto el login cae en /sin-permiso
        'activos-custodia.autorizar-traspaso',  // para probar el flujo completo
        'activos-custodia.autorizar-salida',
    ];

    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command->error('DemoSeeder no se ejecuta en producción.');
            return;
        }

        $usuario = DB::transaction(function () {
            $usuario = User::firstOrNew(['email' => self::EMAIL]);

            $usuario->fill([
                'ci'                 => '0000000',
                'name'               => 'Demo Activos',
                'cargo'              => 'Encargado de Activos Fijos',
                'password'           => self::CLAVE,
                'activo'             => true,
                'debe_cambiar_clave' => false,
            ])->save();

            foreach (self::ROLES as $rol) {
                if (\App\Models\Role::where('name', $rol)->exists()) {
                    $usuario->assignRole($rol);
                } else {
                    $this->command->warn("Rol «{$rol}» inexistente. ¿Corrió ActivosRolesSeeder?");
                }
            }

            foreach (self::PERMISOS_EXTRA as $permiso) {
                if (\Spatie\Permission\Models\Permission::where('name', $permiso)->exists()) {
                    $usuario->givePermissionTo($permiso);
                } else {
                    $this->command->warn("Permiso «{$permiso}» inexistente. ¿Corrió PermisoSeeder?");
                }
            }

            return $usuario;
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $this->command->info('');
        $this->command->info('  Usuario de demostración listo');
        $this->command->info('  ─────────────────────────────');
        $this->command->info('  Correo:     ' . self::EMAIL);
        $this->command->info('  Contraseña: ' . self::CLAVE);
        $this->command->info('  Permisos:   ' . $usuario->getAllPermissions()->count());
        $this->command->info('');
    }
}
