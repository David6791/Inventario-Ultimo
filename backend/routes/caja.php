<?php

use App\Modules\Caja\Http\Controllers\AjusteController;
use App\Modules\Caja\Http\Controllers\CajaController;
use App\Modules\Caja\Http\Controllers\ConceptoController;
use App\Modules\Caja\Http\Controllers\LibroCajaController;
use App\Modules\Caja\Http\Controllers\MovimientoController;
use App\Modules\Caja\Http\Controllers\PersonaController;
use App\Modules\Caja\Http\Controllers\SesionController;
use App\Modules\Caja\Http\Controllers\SolicitudController;
use Illuminate\Support\Facades\Route;

/*
| Rutas del módulo de caja — prefijo api/caja (CajaServiceProvider).
|
|   - Leer exige caja.ver; escribir lo autoriza cada FormRequest
|     (caja.administrar, caja.abrir, caja.registrar, caja.anular).
|   - El cajero solo ve las cajas de sus sedes (AmbitoDeCaja).
|   - Segmentos literales antes de {param}, y todo {param} con whereNumber().
*/

Route::middleware('auth:sanctum')->group(function () {

    // --- Lectura ------------------------------------------------------------
    Route::middleware('can:caja.ver')->group(function () {
        Route::get('opciones', [CajaController::class, 'opciones']);
        Route::get('conceptos', [ConceptoController::class, 'index']);
        Route::get('personas',            [PersonaController::class, 'index']);
        Route::get('personas/coincidencias', [PersonaController::class, 'coincidencias']);
        Route::get('personas/{persona}',  [PersonaController::class, 'show'])->whereNumber('persona');

        Route::get('cajas',                   [CajaController::class, 'index']);
        Route::get('cajas/{caja}',            [CajaController::class, 'show'])->whereNumber('caja');
        Route::get('cajas/{caja}/sesiones',   [SesionController::class, 'index'])->whereNumber('caja');
        Route::get('sesiones',                [SesionController::class, 'lista']);
        Route::get('sesiones/{sesion}',       [SesionController::class, 'show'])->whereNumber('sesion');
        Route::get('sesiones/{sesion}/reporte', [SesionController::class, 'reporte'])->whereNumber('sesion');
        Route::get('movimientos/{movimiento}/comprobante', [MovimientoController::class, 'comprobante'])
            ->whereNumber('movimiento');
    });

    Route::get('cajas/{caja}/solicitudes', [SolicitudController::class, 'deCaja'])
        ->middleware('can:caja.ver')->whereNumber('caja');

    // --- Solicitudes de dinero (permiso en cada controlador o FormRequest) --
    Route::get('solicitudes/opciones',     [SolicitudController::class, 'opciones']);
    Route::get('solicitudes/mias',         [SolicitudController::class, 'mias']);
    Route::get('solicitudes/por-aprobar',  [SolicitudController::class, 'porAprobar']);
    Route::post('solicitudes',             [SolicitudController::class, 'store']);
    Route::post('solicitudes/{solicitud}/aprobar',  [SolicitudController::class, 'aprobar'])->whereNumber('solicitud');
    Route::post('solicitudes/{solicitud}/rechazar', [SolicitudController::class, 'rechazar'])->whereNumber('solicitud');
    Route::post('solicitudes/{solicitud}/anular',   [SolicitudController::class, 'anular'])->whereNumber('solicitud');
    Route::post('solicitudes/{solicitud}/pagar',    [SolicitudController::class, 'pagar'])->whereNumber('solicitud');

    // --- Reportes (caja.reportes, en LibroCajaRequest) ----------------------
    Route::get('libro',        [LibroCajaController::class, 'index']);
    Route::get('libro/pdf',    [LibroCajaController::class, 'pdf']);
    Route::get('libro/excel',  [LibroCajaController::class, 'excel']);

    // --- Administración (caja.administrar, en cada FormRequest) -------------
    Route::post('cajas/vista-previa',     [CajaController::class, 'vistaPrevia']);
    Route::post('cajas',                  [CajaController::class, 'store']);
    Route::put('cajas/{caja}',            [CajaController::class, 'update'])->whereNumber('caja');
    Route::post('conceptos',              [ConceptoController::class, 'store']);
    Route::put('conceptos/{concepto}',    [ConceptoController::class, 'update'])->whereNumber('concepto');
    Route::put('cajas/{caja}/cajeros',    [CajaController::class, 'cajerosActualizar'])->whereNumber('caja');
    Route::put('cajas/{caja}/aprobadores', [CajaController::class, 'aprobadoresActualizar'])->whereNumber('caja');
    Route::put('personas/{persona}',      [PersonaController::class, 'update'])->whereNumber('persona');
    Route::post('personas/{persona}/unificar', [PersonaController::class, 'unificar'])->whereNumber('persona');

    // --- Operación ------------------------------------------------------------
    Route::post('cajas/{caja}/sesiones',             [SesionController::class, 'store'])->whereNumber('caja');
    Route::post('sesiones/{sesion}/movimientos',     [MovimientoController::class, 'store'])->whereNumber('sesion');
    Route::post('sesiones/{sesion}/cerrar',          [SesionController::class, 'cerrar'])->whereNumber('sesion');
    Route::post('sesiones/{sesion}/validar',         [SesionController::class, 'validar'])->whereNumber('sesion');
    Route::post('movimientos/{movimiento}/anular',   [MovimientoController::class, 'anular'])->whereNumber('movimiento');

    // --- Envío de dinero de la sede central a las cajas -----------------------
    Route::get('cajas/{caja}/envios',   [\App\Modules\Caja\Http\Controllers\EnvioFondosController::class, 'deCaja'])->whereNumber('caja')
        ->middleware('can:caja.ver');
    Route::post('cajas/{caja}/envios',  [\App\Modules\Caja\Http\Controllers\EnvioFondosController::class, 'store'])->whereNumber('caja')
        ->middleware('can:caja.registrar');
    Route::post('envios/{envio}/recibir', [\App\Modules\Caja\Http\Controllers\EnvioFondosController::class, 'recibir'])->whereNumber('envio')
        ->middleware('can:caja.registrar');
    Route::post('envios/{envio}/anular',  [\App\Modules\Caja\Http\Controllers\EnvioFondosController::class, 'anular'])->whereNumber('envio')
        ->middleware('can:caja.registrar');

    // --- Comprobantes provisionales: ajuste en el día y validación ----------
    Route::post('movimientos/{movimiento}/ajustes',  [AjusteController::class, 'ajustar'])->whereNumber('movimiento');
    Route::post('movimientos/{movimiento}/validar',  [AjusteController::class, 'validar'])->whereNumber('movimiento');
    Route::post('ajustes/{ajuste}/aprobar',          [AjusteController::class, 'aprobar'])->whereNumber('ajuste');
    Route::post('ajustes/{ajuste}/rechazar',         [AjusteController::class, 'rechazar'])->whereNumber('ajuste');
    Route::post('ajustes/{ajuste}/aplicar',          [AjusteController::class, 'aplicar'])->whereNumber('ajuste');
});
