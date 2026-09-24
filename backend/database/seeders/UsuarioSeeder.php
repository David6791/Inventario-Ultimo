<?php

namespace Database\Seeders;

use App\Enums\Permisos;
use App\Models\Almacen;
use App\Models\User;
use Illuminate\Database\Seeder;

class UsuarioSeeder extends Seeder
{
    public function run(): void
    {
        /*
        | Sin al menos un almacén el sistema no funciona: cada documento
        | necesita uno, y el middleware `almacen` rechaza toda petición sin
        | almacén activo.
        |
        | Los almacenes de ejemplo los crea CatalogoSeeder, que en un despliegue
        | real NO se corre porque arrastra productos de prueba. Por eso el
        | central se asegura acá: es dato base, no dato de ejemplo.
        */
        $central = Almacen::firstOrCreate(
            ['codigo' => 'ALM-CEN'],
            [
                'nombre'      => 'Almacén Central',
                'ubicacion'   => 'Por definir',
                'activo'      => true,
            ]
        );

        // Este solo existe si ya fue sembrado: es de ejemplo.
        $suministros = Almacen::where('codigo', 'ALM-SUM')->first();

        // Único usuario que se crea siempre. En producción, cambiar la
        // contraseña en el primer ingreso (debe_cambiar_clave lo obliga).
        $admin = User::updateOrCreate(
            ['email' => 'admin@inventarios.local'],
            [
                'name'     => 'Administrador del sistema',
                'password' => env('ADMIN_PASSWORD', 'Cambiar2026'),
                'cargo'    => 'Administrador',
                'activo'   => true,
                'debe_cambiar_clave' => true,
            ]
        );

        $admin->syncRoles([Permisos::SUPER_ADMIN]);
        $admin->almacenes()->syncWithoutDetaching([
            $central->id => ['es_predeterminado' => true],
        ]);

        // Los usuarios de ejemplo solo en entorno local. En producción tienen
        // clave conocida y escrita en el código: no deben existir.
        if (! app()->environment('local') || ! $suministros) {
            $this->command?->info('Administrador listo. Los usuarios de ejemplo se omiten fuera de desarrollo.');
            return;
        }

        $ejemplos = [
            ['Juan Pérez',    'jefe@inventarios.local',       'jefe-almacenes',   [$central->id, $suministros->id]],
            // Con los dos almacenes: hace falta para probar transferencias de
            // punta a punta, despachando y recibiendo.
            ['María Choque',  'almacenero@inventarios.local', 'almacenero',       [$central->id, $suministros->id]],
            ['Luis Mamani',   'auxiliar@inventarios.local',   'auxiliar-almacen', [$suministros->id]],
        ];

        foreach ($ejemplos as [$nombre, $correo, $rol, $almacenes]) {
            $usuario = User::updateOrCreate(
                ['email' => $correo],
                ['name' => $nombre, 'password' => 'Prueba2026', 'activo' => true]
            );

            $usuario->syncRoles([$rol]);
            $usuario->almacenes()->sync(
                collect($almacenes)->mapWithKeys(fn ($id, $i) => [
                    $id => ['es_predeterminado' => $i === 0],
                ])->all()
            );
        }
    }
}
