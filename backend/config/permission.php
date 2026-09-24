<?php

/*
| Solo se muestran las claves que hay que tocar respecto del archivo que publica
| el paquete con:
|   php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
|
| Copiar estos valores sobre el archivo publicado; el resto queda por defecto.
*/

return [

    'models' => [
        'permission' => Spatie\Permission\Models\Permission::class,

        // Rol extendido con `descripcion` y `es_sistema`.
        'role' => App\Models\Role::class,
    ],

    'table_names' => [
        'roles'                 => 'roles',
        'permissions'           => 'permissions',
        'model_has_permissions' => 'model_has_permissions',
        'model_has_roles'       => 'model_has_roles',
        'role_has_permissions'  => 'role_has_permissions',
    ],

    'column_names' => [
        'role_pivot_key'       => null,
        'permission_pivot_key' => null,
        'model_morph_key'      => 'model_id',
        'team_foreign_key'     => 'team_id',
    ],

    /*
    | El alcance por almacén se resuelve con la tabla `usuario_almacen` + Policies,
    | no con el modo teams del paquete. El rol define QUÉ puede hacer el usuario;
    | el pivote define DÓNDE. Con teams habría que setear el team activo en cada
    | request y el caché se fragmentaría por almacén.
    */
    'teams' => false,

    'cache' => [
        'expiration_time' => \DateInterval::createFromDateString('24 hours'),
        'key'             => 'spatie.permission.cache',
        'store'           => 'default',
    ],
];
