<?php

namespace Database\Seeders;

use App\Enums\Permisos;
use App\Models\Role;
use App\Services\VersionPermisosService;
use Illuminate\Database\Seeder;

class RolSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->roles() as $definicion) {
            $rol = Role::updateOrCreate(
                ['name' => $definicion['name'], 'guard_name' => 'sanctum'],
                [
                    'descripcion' => $definicion['descripcion'],
                    'es_sistema'  => $definicion['es_sistema'],
                ]
            );

            // El super-admin no lleva permisos en tabla: se resuelve por Gate::before.
            if ($rol->esSuperAdmin()) {
                continue;
            }

            // Solo se siembran permisos en roles recién creados. Si el
            // administrador ya ajustó un rol desde la interfaz, un redespliegue
            // no debe pisarle el trabajo.
            if ($rol->wasRecentlyCreated) {
                $rol->syncPermissions($definicion['permisos']);
            }
        }

        app(VersionPermisosService::class)->invalidar();
    }

    private function roles(): array
    {
        $todos = Permisos::todos();

        $soloLectura = array_values(array_filter(
            $todos,
            fn ($p) => str_ends_with($p, '.ver')
                || str_starts_with($p, 'reportes.')
                || $p === 'kardex.exportar'
        ));

        return [
            [
                'name'        => Permisos::SUPER_ADMIN,
                'descripcion' => 'Acceso total al sistema. No se puede editar ni eliminar.',
                'es_sistema'  => true,
                'permisos'    => [],
            ],
            [
                'name'        => 'jefe-almacenes',
                'descripcion' => 'Supervisa todos los almacenes, confirma y anula documentos.',
                'es_sistema'  => true,
                'permisos'    => array_values(array_diff($todos, [
                    'usuarios.crear', 'usuarios.editar', 'usuarios.desactivar',
                    'usuarios.restablecer-clave',
                    'roles.crear', 'roles.editar', 'roles.eliminar',
                ])),
            ],
            [
                'name'        => 'almacenero',
                'descripcion' => 'Opera su almacén: registra y confirma movimientos.',
                'es_sistema'  => true,
                'permisos'    => [
                    'dashboard.ver',
                    'productos.ver', 'productos.crear', 'productos.editar',
                    'categorias.ver',
                    'almacenes.ver',
                    'solicitantes.ver', 'solicitantes.gestionar',
                    'stock.ver', 'stock.ver-costos',
                    'kardex.ver', 'kardex.exportar',
                    'solicitudes.ver', 'solicitudes.registrar', 'solicitudes.editar',
                    'solicitudes.aprobar', 'solicitudes.anular',
                    'ingresos.ver', 'ingresos.registrar', 'ingresos.editar', 'ingresos.confirmar',
                    'salidas.ver', 'salidas.registrar', 'salidas.editar', 'salidas.confirmar',
                    'transferencias.ver', 'transferencias.registrar', 'transferencias.confirmar',
                    'ajustes.ver', 'ajustes.registrar',
                    'tomas.ver', 'tomas.registrar',
                    'reportes.existencias', 'reportes.movimientos', 'reportes.vencimientos',
                ],
            ],
            [
                'name'        => 'auxiliar-almacen',
                'descripcion' => 'Digita documentos en borrador. No confirma ni anula.',
                'es_sistema'  => false,
                'permisos'    => [
                    'dashboard.ver',
                    'productos.ver', 'categorias.ver', 'almacenes.ver',
                    'solicitantes.ver',
                    'stock.ver', 'kardex.ver',
                    'solicitudes.ver', 'solicitudes.registrar', 'solicitudes.editar',
                    'ingresos.ver', 'ingresos.registrar', 'ingresos.editar',
                    'salidas.ver', 'salidas.registrar', 'salidas.editar',
                    'transferencias.ver', 'transferencias.registrar',
                    'tomas.ver', 'tomas.registrar',
                    'reportes.existencias',
                ],
            ],
            [
                'name'        => 'solicitante',
                'descripcion' => 'Personal de otras unidades: solicita material y sigue su pedido.',
                'es_sistema'  => false,
                'permisos'    => [
                    'dashboard.ver',
                    'productos.ver', 'stock.ver',
                    'salidas.ver',
                ],
            ],
            [
                'name'        => 'auditor',
                'descripcion' => 'Consulta todo el sistema sin poder modificar nada.',
                'es_sistema'  => true,
                'permisos'    => array_merge($soloLectura, [
                    'almacenes.ver-todos',
                    'stock.ver-costos',
                    'auditoria.ver',
                ]),
            ],
        ];
    }
}
