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
