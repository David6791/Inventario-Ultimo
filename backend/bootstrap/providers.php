<?php

use App\Providers\AppServiceProvider;

return [
    AppServiceProvider::class,
    App\Modules\Activos\Providers\ActivosServiceProvider::class,
    App\Modules\Caja\Providers\CajaServiceProvider::class,
    App\Modules\Cargas\Providers\CargasServiceProvider::class,
];
