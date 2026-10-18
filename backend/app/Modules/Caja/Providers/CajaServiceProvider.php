<?php

namespace App\Modules\Caja\Providers;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

/** Módulo de Caja: registra sus rutas bajo api/caja, igual que ActivosServiceProvider. */
class CajaServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Route::middleware('api')
            ->prefix('api/caja')
            ->group(base_path('routes/caja.php'));
    }
}
