<?php

use App\Modules\Caja\Http\Controllers\CajaController;
use App\Modules\Caja\Http\Controllers\ConceptoController;
use App\Modules\Caja\Http\Controllers\MovimientoController;
use App\Modules\Caja\Http\Controllers\PersonaController;
use App\Modules\Caja\Http\Controllers\SesionController;
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
        Route::get('personas/{persona}',  [PersonaController::class, 'show'])->whereNumber('persona');

        Route::get('cajas',                   [CajaController::class, 'index']);
        Route::get('cajas/{caja}',            [CajaController::class, 'show'])->whereNumber('caja');
        Route::get('cajas/{caja}/sesiones',   [SesionController::class, 'index'])->whereNumber('caja');
        Route::get('sesiones/{sesion}',       [SesionController::class, 'show'])->whereNumber('sesion');
        Route::get('movimientos/{movimiento}/comprobante', [MovimientoController::class, 'comprobante'])
            ->whereNumber('movimiento');
    });

    // --- Administración (caja.administrar, en cada FormRequest) -------------
    Route::post('cajas/vista-previa',     [CajaController::class, 'vistaPrevia']);
    Route::post('cajas',                  [CajaController::class, 'store']);
    Route::put('cajas/{caja}',            [CajaController::class, 'update'])->whereNumber('caja');
    Route::post('conceptos',              [ConceptoController::class, 'store']);
    Route::put('conceptos/{concepto}',    [ConceptoController::class, 'update'])->whereNumber('concepto');
    Route::put('cajas/{caja}/cajeros',    [CajaController::class, 'cajerosActualizar'])->whereNumber('caja');
    Route::put('personas/{persona}',      [PersonaController::class, 'update'])->whereNumber('persona');

    // --- Operación ------------------------------------------------------------
    Route::post('cajas/{caja}/sesiones',             [SesionController::class, 'store'])->whereNumber('caja');
    Route::post('sesiones/{sesion}/movimientos',     [MovimientoController::class, 'store'])->whereNumber('sesion');
    Route::post('movimientos/{movimiento}/anular',   [MovimientoController::class, 'anular'])->whereNumber('movimiento');
});
