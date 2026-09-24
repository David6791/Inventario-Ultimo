<?php

use App\Http\Controllers\Api\AlmacenController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoriaController;
use App\Http\Controllers\Api\ExistenciaController;
use App\Http\Controllers\Api\IngresoController;
use App\Http\Controllers\Api\KardexController;
use App\Http\Controllers\Api\PermisoController;
use App\Http\Controllers\Api\ProductoController;
use App\Http\Controllers\Api\ProductoImportController;
use App\Http\Controllers\Api\ReporteController;
use App\Http\Controllers\Api\RolController;
use App\Http\Controllers\Api\SalidaController;
use App\Http\Controllers\Api\SolicitanteController;
use App\Http\Controllers\Api\SolicitudCompraController;
use App\Http\Controllers\Api\TableroController;
use App\Http\Controllers\Api\TransferenciaController;
use App\Http\Controllers\Api\UnidadMedidaController;
use App\Http\Controllers\Api\UsuarioController;
use App\Http\Controllers\Api\DevolucionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rutas de la API
|--------------------------------------------------------------------------
|
| Organización:
|
|   - Públicas: solo el login.
|   - Autenticadas: todo lo demás, bajo `auth:sanctum`.
|   - Dentro de ellas, el grupo `almacen` fija el almacén activo. Los
|     documentos que mueven existencias viven ahí, porque necesitan saber
|     sobre qué almacén operan.
|
| Los catálogos de la institución (productos, solicitantes, roles) quedan
| fuera del grupo `almacen`: no pertenecen a un almacén en particular.
|
| Nota sobre el orden: una ruta literal debe declararse ANTES que una con
| parámetro que la pueda capturar. `/ingresos/pendientes` antes que
| `/ingresos/{ingreso}`, o Laravel buscaría un ingreso con id "pendientes".
|
*/

// --- Públicas ---------------------------------------------------------------

Route::post('/login', [AuthController::class, 'login']);

// --- Autenticadas -----------------------------------------------------------

Route::middleware('auth:sanctum')->group(function () {

    /*
    | El almacén activo NO se cambia por endpoint: viaja en la cabecera
    | `X-Almacen-Id` que inyecta el interceptor de Angular, y el middleware
    | `almacen` lo resuelve en cada petición. Así no hay estado de sesión que
    | se pueda desincronizar entre pestañas.
    */
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/cambiar-clave', [AuthController::class, 'cambiarClave']);

    /*
    | Catálogos de la institución.
    */
    Route::apiResource('productos', ProductoController::class)
        ->parameters(['productos' => 'producto']);
    Route::get('/productos-buscar', [ProductoController::class, 'buscar']);

    /*
    | Carga masiva desde Excel. `revisar` no escribe nada: devuelve qué pasaría.
    | Van antes del recurso para que no caigan en /productos/{producto}.
    */
    Route::get('/productos-plantilla', [ProductoImportController::class, 'plantilla']);
    Route::post('/productos-importar/revisar', [ProductoImportController::class, 'revisar']);
    Route::post('/productos-importar', [ProductoImportController::class, 'importar']);

    Route::apiResource('categorias', CategoriaController::class)
        ->parameters(['categorias' => 'categoria'])
        ->only(['index', 'store', 'update', 'destroy']);

    Route::apiResource('unidades-medida', UnidadMedidaController::class)
        ->parameters(['unidades-medida' => 'unidad'])
        ->only(['index', 'store', 'update', 'destroy']);

    /*
    | `parameters()` explícito en todos los recursos.
    |
    | Laravel deriva el nombre del parámetro singularizando EN INGLÉS: 'roles'
    | da {role}, 'almacenes' da {almacene}. Si ese nombre no coincide con la
    | variable del controlador, la vinculación de modelo NO ocurre y Laravel
    | inyecta un modelo VACÍO — la API responde 200 con todos los campos en
    | nulo, sin ningún error. Es de los fallos más difíciles de rastrear.
    */
    Route::apiResource('almacenes', AlmacenController::class)
        ->parameters(['almacenes' => 'almacen'])
        ->only(['index', 'store', 'update']);

    /*
    | Unidades y solicitantes. No son usuarios del sistema: la mayoría nunca
    | entra a la aplicación.
    */
    Route::get('/unidades-solicitantes', [SolicitanteController::class, 'unidades']);
    Route::post('/unidades-solicitantes', [SolicitanteController::class, 'guardarUnidad']);
    Route::put('/unidades-solicitantes/{unidad}', [SolicitanteController::class, 'actualizarUnidad']);
    Route::delete('/unidades-solicitantes/{unidad}', [SolicitanteController::class, 'eliminarUnidad']);

    Route::apiResource('solicitantes', SolicitanteController::class)
        ->parameters(['solicitantes' => 'solicitante'])
        ->only(['index', 'store', 'update', 'destroy']);

    /*
    | Administración.
    */
    Route::apiResource('usuarios', UsuarioController::class)
        ->parameters(['usuarios' => 'usuario']);

    Route::apiResource('roles', RolController::class)
        ->parameters(['roles' => 'rol']);
    Route::post('/roles/{rol}/duplicar', [RolController::class, 'duplicar']);
    Route::get('/permisos', [PermisoController::class, 'index']);

    /*
    |----------------------------------------------------------------------
    | Operaciones sobre un almacén
    |----------------------------------------------------------------------
    |
    | El middleware `almacen` resuelve cuál es el almacén activo y verifica
    | que el usuario tenga acceso. Todo lo que mueve existencias va acá.
    */
    Route::middleware('almacen')->group(function () {

        // --- Tablero ---
        // Lo que requiere acción hoy, filtrado por permiso.
        Route::get('/tablero', [TableroController::class, 'index']);

        // --- Solicitudes de compra ---
        Route::apiResource('solicitudes-compra', SolicitudCompraController::class)
            ->parameters(['solicitudes-compra' => 'id']);
        Route::post('/solicitudes-compra/{id}/aprobar', [SolicitudCompraController::class, 'aprobar']);
        Route::post('/solicitudes-compra/{id}/anular', [SolicitudCompraController::class, 'anular']);
        Route::get('/solicitudes-compra/{id}/documento', [SolicitudCompraController::class, 'documento']);
        Route::get('/solicitudes-compra/{id}/pdf', [SolicitudCompraController::class, 'pdf']);

        // --- Ingresos ---
        // `pendientes` antes del recurso: si no, caería en `{ingreso}`.
        Route::get('/ingresos/pendientes', [IngresoController::class, 'pendientes']);
        Route::apiResource('ingresos', IngresoController::class)
            ->parameters(['ingresos' => 'ingreso']);
        Route::post('/ingresos/{ingreso}/confirmar', [IngresoController::class, 'confirmar']);
        Route::post('/ingresos/{ingreso}/anular', [IngresoController::class, 'anular']);
        Route::post('/ingresos/{ingreso}/respaldo', [IngresoController::class, 'subirRespaldo']);
        Route::get('/ingresos/{ingreso}/respaldo', [IngresoController::class, 'respaldo']);
        Route::get('/ingresos/{ingreso}/pdf', [IngresoController::class, 'pdf']);

        // --- Salidas ---
        Route::apiResource('salidas', SalidaController::class)
            ->parameters(['salidas' => 'salida']);
        Route::post('/salidas/{salida}/confirmar', [SalidaController::class, 'confirmar']);
        Route::post('/salidas/{salida}/anular', [SalidaController::class, 'anular']);
        Route::post('/salidas/{salida}/respaldo', [SalidaController::class, 'subirRespaldo']);
        Route::get('/salidas/{salida}/respaldo', [SalidaController::class, 'respaldo']);
        Route::get('/salidas/{salida}/pdf', [SalidaController::class, 'pdf']);

                // --- Devoluciones ---
        // Contra una salida: el costo sale de las capas que esa salida consumió.
        // `devolvible` antes del recurso, por el mismo motivo que `pendientes`.
        Route::get('/salidas/{salida}/devolvible', [DevolucionController::class, 'devolvible']);
        Route::apiResource('devoluciones', DevolucionController::class)
            ->parameters(['devoluciones' => 'devolucion'])
            ->only(['index', 'show', 'store']);
        Route::post('/devoluciones/{devolucion}/anular', [DevolucionController::class, 'anular']);
        Route::post('/devoluciones/{devolucion}/respaldo', [DevolucionController::class, 'subirRespaldo']);
        Route::get('/devoluciones/{devolucion}/respaldo', [DevolucionController::class, 'respaldo']);
        Route::get('/devoluciones/{devolucion}/pdf', [DevolucionController::class, 'pdf']);

        // --- Transferencias ---
        // Despacha quien está asignado al origen, recibe quien está en el
        // destino: la membresía de almacén hace de control.
        Route::apiResource('transferencias', TransferenciaController::class)
            ->parameters(['transferencias' => 'transferencia']);
        Route::post('/transferencias/{transferencia}/despachar', [TransferenciaController::class, 'despachar']);
        Route::post('/transferencias/{transferencia}/recibir', [TransferenciaController::class, 'recibir']);
        Route::post('/transferencias/{transferencia}/anular', [TransferenciaController::class, 'anular']);
        Route::get('/transferencias/{transferencia}/pdf', [TransferenciaController::class, 'pdf']);

        // --- Existencias y kardex (solo lectura) ---
        // `resumen` antes de `{producto}`, por el mismo motivo que arriba.
        Route::get('/existencias/resumen', [ExistenciaController::class, 'resumen']);
        Route::get('/existencias', [ExistenciaController::class, 'index']);
        Route::get('/existencias/{producto}', [ExistenciaController::class, 'show']);

        Route::get('/kardex/{producto}/encabezado', [KardexController::class, 'encabezado']);
        Route::get('/kardex/{producto}/pdf', [KardexController::class, 'pdf']);
        Route::get('/kardex/{producto}', [KardexController::class, 'index']);

        // --- Reportes ---
        // Un controlador para los cuatro tipos y los tres formatos.
        Route::get('/reportes/{tipo}/pdf', [ReporteController::class, 'pdf']);
        Route::get('/reportes/{tipo}/excel', [ReporteController::class, 'excel']);
        Route::get('/reportes/{tipo}', [ReporteController::class, 'mostrar']);
    });
});
