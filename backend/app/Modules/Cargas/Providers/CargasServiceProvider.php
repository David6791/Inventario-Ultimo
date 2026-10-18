<?php

namespace App\Modules\Cargas\Providers;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/** Módulo de Manejo de cargas: registra sus rutas bajo api/cargas, igual que ActivosServiceProvider. */
class CargasServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Route::middleware('api')
            ->prefix('api/cargas')
            ->group(base_path('routes/cargas.php'));
    }
}
