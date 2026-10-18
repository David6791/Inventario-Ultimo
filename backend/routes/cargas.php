<?php

use App\Modules\Cargas\Http\Controllers\EstadoController;
use Illuminate\Support\Facades\Route;

/*
| Rutas del módulo de cargas — prefijo api/cargas (se registra en bootstrap/app.php).
| Recordatorio: los segmentos literales van ANTES de {param}, y toda ruta con
| parámetro numérico lleva ->whereNumber().
*/

Route::middleware('auth:sanctum')->group(function () {
    Route::get('estado', EstadoController::class)->middleware('can:cargas.ver');
});
