<?php

namespace Database\Seeders;

use App\Enums\Permisos;
use App\Models\Role;
use App\Services\VersionPermisosService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use RuntimeException;

/**
 * Roles de arranque del módulo de Activos Fijos.
 *
 *   php artisan db:seed --class=PermisoSeeder        (primero: crea los permisos)
 *   php artisan db:seed --class=ActivosRolesSeeder   (después: crea los roles)
 *
 * Este seeder NO crea permisos. La fuente de verdad es App\Enums\Permisos y
 * quien los siembra es PermisoSeeder. Acá solo se arman roles combinándolos.
 *
 * Idempotente: si un rol ya existe, se deja intacto. Los permisos de un rol
 * existente los administra el usuario desde la pantalla de roles.
 */
class ActivosRolesSeeder extends Seeder
{
    private const GUARD = 'sanctum';

    /**
     * Los tres roles respetan las incompatibilidades de la matriz de
     * segregación del Manual de Procedimientos: ninguno junta calcular con
     * cerrar el período, registrar con aprobar un revalúo, ni solicitar con
     * autorizar una baja.
     */
    private const ROLES = [
        'Encargado de Activos Fijos' => [
            'descripcion' => 'Registra, custodia y calcula. No cierra el período ni autoriza bajas.',
            'permisos' => [
                'activos.ver', 'activos.crear', 'activos.editar', 'activos.codificar', 'activos.reportes',
                'activos-custodia.asignar', 'activos-custodia.traspasar',
                'activos-custodia.salida', 'activos-custodia.descargar',
                'activos-mantenimiento.ver', 'activos-mantenimiento.registrar',
                'activos-mantenimiento.seguros',
                'activos-valuacion.ver', 'activos-valuacion.calcular',
                'activos-valuacion.valor-recuperable', 'activos-valuacion.revaluo-registrar',
                'activos-inventario.ver', 'activos-inventario.planificar',
                'activos-inventario.tomar', 'activos-inventario.resolver',
                'activos-bajas.ver', 'activos-bajas.solicitar',
                'activos-config.ver', 'activos-config.administrar',
            ],
        ],

        'Contabilidad — Activos' => [
            'descripcion' => 'Revisa y cierra el período de valuación. No registra ni modifica activos.',
            'permisos' => [
                'activos.ver', 'activos.reportes',
                'activos-valuacion.ver', 'activos-valuacion.cerrar',
                'activos-valuacion.revaluo-contabilizar',
                'activos-inventario.ver',
                'activos-bajas.ver',
            ],
        ],

        'Custodio de Bienes' => [
            'descripcion' => 'Consulta los bienes a su cargo y solicita bajas.',
            'permisos' => [
                'activos.ver',
                'activos-bajas.solicitar',
            ],
        ],
    ];

    public function run(): void
    {
        $this->validarCatalogo();

        DB::transaction(fn () => $this->sembrarRoles());

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        app(VersionPermisosService::class)->invalidar();

        $this->command->info('Cache de permisos invalidada.');
    }

    /**
     * Falla temprano y con un mensaje útil si el bloque de activos todavía no
     * está en el enum, en lugar de crear roles vacíos en silencio.
     */
    private function validarCatalogo(): void
    {
        $declarados = Permisos::todos();

        $usados = collect(self::ROLES)
            ->flatMap(fn ($r) => $r['permisos'])
            ->unique();

        $faltantes = $usados->diff($declarados);

        if ($faltantes->isNotEmpty()) {
            throw new RuntimeException(sprintf(
                "Faltan %d permisos en App\\Enums\\Permisos::CATALOGO: %s\n"
                ."Agregue el bloque del módulo de activos al enum y ejecute "
                ."«php artisan db:seed --class=PermisoSeeder» antes de este seeder.",
                $faltantes->count(),
                $faltantes->take(5)->implode(', ') . ($faltantes->count() > 5 ? '...' : '')
            ));
        }

        // Los permisos están en el enum pero pueden no estar en la tabla.
        $enTabla = Permission::whereIn('name', $usados)
            ->where('guard_name', self::GUARD)
            ->pluck('name');

        $sinSembrar = $usados->diff($enTabla);

        if ($sinSembrar->isNotEmpty()) {
            throw new RuntimeException(sprintf(
                "Hay %d permisos declarados en el enum pero ausentes de la tabla "
                ."para el guard \"%s\".\nEjecute «php artisan db:seed --class=PermisoSeeder» primero.\n"
                ."Si PermisoSeeder los crea con otro guard, ahí está el problema: "
                ."los roles usan \"%s\".",
                $sinSembrar->count(), self::GUARD, self::GUARD
            ));
        }
    }

    private function sembrarRoles(): void
    {
        foreach (self::ROLES as $nombre => $config) {
            $rol = Role::firstOrNew(['name' => $nombre, 'guard_name' => self::GUARD]);

            if ($rol->exists) {
                $this->command->warn("Ya existe, se deja intacto: {$nombre}");
                continue;
            }

            $rol->descripcion = $config['descripcion'];
            $rol->es_sistema  = false;   // el administrador puede renombrarlo y ajustarlo
            $rol->save();

            $permisos = Permission::whereIn('name', $config['permisos'])
                ->where('guard_name', self::GUARD)
                ->get();

            $rol->syncPermissions($permisos);

            $this->command->info("Rol creado: {$nombre} ({$permisos->count()} permisos)");
        }
    }
}
