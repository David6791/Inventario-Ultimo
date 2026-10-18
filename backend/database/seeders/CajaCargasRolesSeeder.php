<?php

namespace Database\Seeders;

use App\Enums\Permisos;
use App\Models\Role;
use App\Services\VersionPermisosService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

/**
 * Roles de arranque de los módulos de Caja y Manejo de cargas.
 *
 *   php artisan db:seed --class=PermisoSeeder          (primero: crea los permisos)
 *   php artisan db:seed --class=CajaCargasRolesSeeder  (después: crea los roles)
 *
 * Igual que ActivosRolesSeeder: NO crea permisos (la fuente de verdad es
 * App\Enums\Permisos y los siembra PermisoSeeder) y es idempotente: si un rol
 * ya existe se deja intacto, porque sus permisos los administra el usuario
 * desde la pantalla de roles.
 *
 * Segregación: ningún rol junta registrar con autorizar un anticipo, editar
 * con aprobar precios, ni cerrar con validar la caja. La base de datos además
 * impide que la MISMA persona haga ambas cosas, aunque tenga los dos permisos.
 */
class CajaCargasRolesSeeder extends Seeder
{
    private const GUARD = 'sanctum';

    public const ROLES = [
        'Cajero' => [
            'descripcion' => 'Abre, registra y cierra la caja; paga anticipos y bonos. No valida cierres.',
            'permisos' => [
                'caja.ver', 'caja.abrir', 'caja.registrar', 'caja.anular', 'caja.cerrar',
                'caja.pagar-anticipo', 'caja.pagar-bono',
            ],
        ],

        'Supervisor de Caja' => [
            'descripcion' => 'Revisa y valida los cierres de caja de los cajeros.',
            'permisos' => [
                'caja.ver', 'caja.validar', 'caja.reportes',
            ],
        ],

        'Recepción de Cargas' => [
            'descripcion' => 'Registra los lotes que llegan y sus pesajes.',
            'permisos' => [
                'cargas.ver', 'cargas.recibir',
            ],
        ],

        'Laboratorio' => [
            'descripcion' => 'Registra muestras y carga análisis. No fija la ley final.',
            'permisos' => [
                'cargas.ver', 'cargas.muestrear', 'cargas.cargar-analisis',
            ],
        ],

        'Jefe de Compras de Mineral' => [
            'descripcion' => 'Administra catálogos, fija leyes, arma precios y registra anticipos. No aprueba precios ni autoriza anticipos.',
            'permisos' => [
                'cargas.ver', 'cargas.catalogos', 'cargas.series', 'cargas.recibir', 'cargas.anular-lote',
                'cargas.configurar-bono', 'cargas.fijar-ley', 'cargas.precios-editar', 'cargas.cotizaciones',
                'cargas.anticipo-registrar',
            ],
        ],

        'Gerencia de Compras' => [
            'descripcion' => 'Aprueba tablas de precio y autoriza anticipos. Administra las cajas.',
            'permisos' => [
                'cargas.ver', 'cargas.ver-todos-almacenes', 'cargas.precios-aprobar', 'cargas.anticipo-autorizar',
                'caja.ver', 'caja.administrar', 'caja.reportes',
            ],
        ],

        'Contabilidad — Cargas' => [
            'descripcion' => 'Consulta lotes y caja, registra cotizaciones y retenciones.',
            'permisos' => [
                'cargas.ver', 'cargas.ver-todos-almacenes', 'cargas.cotizaciones', 'cargas.retenciones',
                'caja.ver', 'caja.reportes',
            ],
        ],
    ];

    /** Pares que ningún rol de arranque puede tener juntos. */
    public const INCOMPATIBLES = [
        ['cargas.precios-editar', 'cargas.precios-aprobar'],
        ['cargas.anticipo-registrar', 'cargas.anticipo-autorizar'],
        ['caja.cerrar', 'caja.validar'],
    ];

    public function run(): void
    {
        self::verificarSegregacion();
        $this->validarCatalogo();

        DB::transaction(fn () => $this->sembrarRoles());

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        app(VersionPermisosService::class)->invalidar();

        $this->command?->info('Cache de permisos invalidada.');
    }

    public static function verificarSegregacion(): void
    {
        foreach (self::ROLES as $rol => $config) {
            foreach (self::INCOMPATIBLES as [$a, $b]) {
                if (in_array($a, $config['permisos'], true) && in_array($b, $config['permisos'], true)) {
                    throw new RuntimeException("El rol «{$rol}» tiene {$a} y {$b}: rompe la segregación de funciones.");
                }
            }
        }
    }

    /** Falla temprano si faltan permisos en el enum o en la tabla, en vez de crear roles vacíos. */
    private function validarCatalogo(): void
    {
        $usados = collect(self::ROLES)->flatMap(fn ($r) => $r['permisos'])->unique();

        $faltantes = $usados->diff(Permisos::todos());
        if ($faltantes->isNotEmpty()) {
            throw new RuntimeException(
                'Faltan permisos en App\\Enums\\Permisos::CATALOGO: ' . $faltantes->implode(', ')
            );
        }

        $sinSembrar = $usados->diff(
            Permission::whereIn('name', $usados)->where('guard_name', self::GUARD)->pluck('name')
        );
        if ($sinSembrar->isNotEmpty()) {
            throw new RuntimeException(
                'Hay permisos de caja y cargas en el enum pero no en la tabla (' . $sinSembrar->implode(', ') . '). '
                . 'Ejecute «php artisan db:seed --class=PermisoSeeder» primero.'
            );
        }
    }

    private function sembrarRoles(): void
    {
        foreach (self::ROLES as $nombre => $config) {
            $rol = Role::firstOrNew(['name' => $nombre, 'guard_name' => self::GUARD]);

            if ($rol->exists) {
                $this->command?->warn("Ya existe, se deja intacto: {$nombre}");
                continue;
            }

            $rol->descripcion = $config['descripcion'];
            $rol->es_sistema  = false;
            $rol->save();

            $permisos = Permission::whereIn('name', $config['permisos'])
                ->where('guard_name', self::GUARD)
                ->get();

            $rol->syncPermissions($permisos);

            $this->command?->info("Rol creado: {$nombre} ({$permisos->count()} permisos)");
        }
    }
}
