<?php

use App\Modules\Activos\Http\Controllers\ClaseController;
use App\Modules\Activos\Http\Controllers\ParametroController;
use App\Modules\Activos\Http\Controllers\SubclaseController;
use App\Modules\Activos\Http\Controllers\UbicacionController;
use App\Modules\Activos\Http\Controllers\ActivoController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Módulo de Activos Fijos — Sprint 1: catálogos y parámetros
|--------------------------------------------------------------------------
| Reemplaza routes/activos.php del paquete del sprint 1.
| Nombres de permiso alineados a la convención modulo.accion del enum.
| El super-admin pasa por Gate::before y no necesita estos permisos en tabla.
*/

Route::middleware(['auth:sanctum'])->group(function () {

/* ---------------------------------------------------- Sprint 2 ------ */

    Route::middleware('can:activos.ver')->group(function () {
        Route::get('activos',                 [ActivoController::class, 'index']);
        Route::get('activos/codigo/{codigo}', [ActivoController::class, 'porCodigo']);
        Route::get('activos/{activo}',        [ActivoController::class, 'show']);
    });

    Route::middleware('can:activos.crear')->group(function () {
        Route::post('activos', [ActivoController::class, 'store']);
    });

    Route::middleware('can:activos.editar')->group(function () {
        Route::put('activos/{activo}', [ActivoController::class, 'update']);
    });

    Route::middleware('can:activos.codificar')->group(function () {
        Route::post('activos/etiquetas', [ActivoController::class, 'etiquetas']);
    });

    // Responde 405 con explicación: los activos se dan de baja, no se borran.
    Route::delete('activos/{activo}', [ActivoController::class, 'destroy']);

    Route::middleware('can:activos-config.ver')->group(function () {
        Route::get('clases',                        [ClaseController::class, 'index']);
        Route::get('clases/{clase}',                [ClaseController::class, 'show']);
        Route::get('subclases',                     [SubclaseController::class, 'index']);
        Route::get('ubicaciones',                   [UbicacionController::class, 'index']);
        Route::get('ubicaciones/arbol',             [UbicacionController::class, 'arbol']);
        Route::get('parametros',                    [ParametroController::class, 'index']);
        Route::get('parametros/{clave}/historial',  [ParametroController::class, 'historial']);
        Route::get('parametros/{clave}/valor',      [ParametroController::class, 'valorA']);
    });

    Route::middleware('can:activos-config.administrar')->group(function () {
        Route::post('clases',                     [ClaseController::class, 'store']);
        Route::put('clases/{clase}',              [ClaseController::class, 'update']);
        Route::delete('clases/{clase}',           [ClaseController::class, 'destroy']);

        Route::post('subclases',                  [SubclaseController::class, 'store']);
        Route::put('subclases/{subclase}',        [SubclaseController::class, 'update']);
        Route::delete('subclases/{subclase}',     [SubclaseController::class, 'destroy']);

        Route::post('ubicaciones',                [UbicacionController::class, 'store']);
        Route::put('ubicaciones/{ubicacion}',     [UbicacionController::class, 'update']);
        Route::delete('ubicaciones/{ubicacion}',  [UbicacionController::class, 'destroy']);

        Route::put('parametros/{clave}',          [ParametroController::class, 'actualizar']);
    });
});
