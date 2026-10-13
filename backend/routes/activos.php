<?php

use App\Modules\Activos\Http\Controllers\ClaseController;
use App\Modules\Activos\Http\Controllers\ParametroController;
use App\Modules\Activos\Http\Controllers\SubclaseController;
use App\Modules\Activos\Http\Controllers\UbicacionController;
use App\Modules\Activos\Http\Controllers\ActivoController;
use App\Modules\Activos\Http\Controllers\ImportacionController;
use App\Modules\Activos\Http\Controllers\DocumentoController;
use App\Modules\Activos\Http\Controllers\CustodioController;
use App\Modules\Activos\Http\Controllers\CierreController;
use App\Modules\Activos\Http\Controllers\EmpleadoController;
use App\Modules\Activos\Http\Controllers\CentroCostoController;
use App\Modules\Activos\Http\Controllers\AlmacenController;
use App\Modules\Activos\Http\Controllers\FotoController;
use App\Modules\Activos\Http\Controllers\ConsultaPublicaController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Módulo de Activos Fijos — Sprint 1: catálogos y parámetros
|--------------------------------------------------------------------------
| Reemplaza routes/activos.php del paquete del sprint 1.
| Nombres de permiso alineados a la convención modulo.accion del enum.
| El super-admin pasa por Gate::before y no necesita estos permisos en tabla.
*/
Route::get('consulta/{codigo}', [ConsultaPublicaController::class, 'porCodigo'])
     ->middleware('throttle:60,1')
     ->where('codigo', '[A-Za-z0-9\-]+');
Route::middleware(['auth:sanctum'])->group(function () {
        Route::get('activos/{activo}/fotos',  [FotoController::class, 'index'])
         ->whereNumber('activo')->middleware('can:activos.ver');

        Route::post('activos/{activo}/fotos', [FotoController::class, 'store'])
            ->whereNumber('activo')->middleware('can:activos.editar');

        Route::post('fotos/{foto}/principal', [FotoController::class, 'marcarPrincipal'])
            ->whereNumber('foto')->middleware('can:activos.editar');

        Route::delete('fotos/{foto}',         [FotoController::class, 'destroy'])
            ->whereNumber('foto');
    /* --------------------------------------- Personal y organización ---- */
    Route::get('almacenes', [AlmacenController::class, 'index']);
    Route::middleware('can:activos-config.administrar')->group(function () {
        Route::post('empleados',                   [EmpleadoController::class, 'store']);
        Route::put('empleados/{empleado}',         [EmpleadoController::class, 'update'])->whereNumber('empleado');
        Route::post('empleados/{empleado}/baja',   [EmpleadoController::class, 'darDeBaja'])->whereNumber('empleado');
        Route::get('empleados/importar/plantilla', [EmpleadoController::class, 'plantilla']);

        // ANTES que empleados/{empleado}
        Route::post('empleados/importar/validar',  [EmpleadoController::class, 'validarImportacion']);
        Route::post('empleados/importar',          [EmpleadoController::class, 'importar']);

        Route::post('centros-costo',               [CentroCostoController::class, 'store']);
        Route::put('centros-costo/{centro}',       [CentroCostoController::class, 'update'])->whereNumber('centro');
    });
    Route::middleware('can:activos.ver')->group(function () {
        Route::get('empleados',            [EmpleadoController::class, 'index']);
        Route::get('empleados/{empleado}', [EmpleadoController::class, 'show'])->whereNumber('empleado');
        Route::get('centros-costo',        [CentroCostoController::class, 'index']);
        Route::get('areas',                [CentroCostoController::class, 'areas']);
    });
    /* ------------------------------------------ Sprint 5: valuación ----- */

    Route::middleware('can:activos-valuacion.ver')->group(function () {
        Route::get('cierres',                      [CierreController::class, 'index']);
        Route::get('cierres/{cierre}',             [CierreController::class, 'show'])->whereNumber('cierre');
        Route::get('cierres/{cierre}/detalle',     [CierreController::class, 'detalle'])->whereNumber('cierre');
        Route::get('cierres/{cierre}/conciliacion',[CierreController::class, 'conciliacion'])->whereNumber('cierre');
    });

    Route::middleware('can:activos-valuacion.calcular')->group(function () {
        Route::post('cierres',                  [CierreController::class, 'abrir']);
        Route::post('cierres/{cierre}/calcular',[CierreController::class, 'calcular'])->whereNumber('cierre');
    });

    // El permiso fino de cada acción lo valida el controlador: cerrar y
    // reabrir exigen permisos distintos de calcular.
    Route::post('cierres/{cierre}/cerrar',  [CierreController::class, 'cerrar'])->whereNumber('cierre');
    Route::post('cierres/{cierre}/reabrir', [CierreController::class, 'reabrir'])->whereNumber('cierre');

    Route::post('valor-recuperable', [CierreController::class, 'registrarValorRecuperable']);
    /* ------------------------------------------- Sprint 4: custodia ----- */

    Route::middleware('can:activos.ver')->group(function () {
        Route::get('documentos',              [DocumentoController::class, 'index']);
        Route::get('documentos/{documento}',  [DocumentoController::class, 'show'])
             ->whereNumber('documento');
        Route::get('custodios/{custodio}/activos', [DocumentoController::class, 'porCustodio'])
             ->whereNumber('custodio');
        Route::get('custodios',                    [CustodioController::class, 'index']);
        Route::get('custodios/{custodio}/resumen', [CustodioController::class, 'resumen'])
         ->whereNumber('custodio');
    });

    // El permiso fino lo resuelve DocumentoRequest según el tipo.
    Route::post('documentos', [DocumentoController::class, 'store']);

    Route::post('documentos/{documento}/confirmar', [DocumentoController::class, 'confirmar'])
         ->whereNumber('documento');
    Route::post('documentos/{documento}/anular',    [DocumentoController::class, 'anular'])
         ->whereNumber('documento');
    Route::post('documentos/{documento}/retorno',   [DocumentoController::class, 'registrarRetorno'])
         ->whereNumber('documento');
/* ---------------------------------------------------- Sprint 2 ------ */

    Route::middleware('can:activos.ver')->group(function () {
        Route::get('activos',                 [ActivoController::class, 'index']);
        Route::get('activos/codigo/{codigo}', [ActivoController::class, 'porCodigo']);
        Route::get('activos/{activo}', [ActivoController::class, 'show'])->whereNumber('activo');
        Route::put('activos/{activo}', [ActivoController::class, 'update'])->whereNumber('activo');
        Route::delete('activos/{activo}', [ActivoController::class, 'destroy'])->whereNumber('activo');
    });

    Route::middleware('can:activos.crear')->group(function () {
        Route::post('activos', [ActivoController::class, 'store']);
        Route::get('activos/importar/plantilla', [ImportacionController::class, 'plantilla']);
        Route::post('activos/importar/validar',  [ImportacionController::class, 'validar']);
        Route::post('activos/importar',          [ImportacionController::class, 'importar']);
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
