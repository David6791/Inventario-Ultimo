<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

/*
| Los comandos de app/Console/Commands se descubren solos, siempre que este
| archivo exista y esté declarado en bootstrap/app.php:
|
|   commands: __DIR__.'/../routes/console.php',
|
| Si falta esa línea, `php artisan list` no muestra los comandos propios.
*/

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Muestra una cita inspiradora');

Artisan::command('cargas:limpiar-fotos {--horas=24}', function (\App\Modules\Cargas\Services\FotoRecepcionService $fotos) {
    $n = $fotos->limpiarSueltas((int) $this->option('horas'));
    $this->info("Fotos sin pesaje eliminadas: {$n}.");
})->purpose('Borra las fotos de recepción que nunca se ligaron a un pesaje');
