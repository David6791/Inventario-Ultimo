<?php

namespace App\Modules\Activos\Providers;

use App\Modules\Activos\Services\ParametroService;
use App\Modules\Activos\Services\SecuenciaService;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class ActivosServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ParametroService::class);
        $this->app->singleton(SecuenciaService::class, fn ($app) =>
            new SecuenciaService($app->make(ParametroService::class))
        );
    }

    public function boot(): void
    {
        Route::middleware('api')
            ->prefix('api/activos')
            ->group(base_path('routes/activos.php'));
    }
}
