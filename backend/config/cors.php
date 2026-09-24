<?php

/*
| Sin esto el navegador bloquea toda llamada desde Angular y el error que ve el
| desarrollador es un "status 0" sin más pistas. Publicar con:
|   php artisan config:publish cors
|
| ATENCIÓN: 'allowed_origins' => ['*'] funciona en desarrollo pero NO en
| producción. Liste los dominios reales.
*/

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        env('FRONTEND_URL', 'http://localhost:4200'),
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    /*
    | Sin esta línea el interceptor de Angular NO puede leer X-Permisos-Version:
    | el navegador oculta las cabeceras personalizadas salvo que se expongan.
    | Es la causa más común de que la sincronización de permisos "no funcione".
    */
    'exposed_headers' => ['X-Permisos-Version'],

    'max_age' => 0,

    /*
    | false porque la autenticación es por token Bearer, no por cookie de sesión.
    | Si algún día migra a Sanctum modo SPA con cookies, esto pasa a true y
    | 'allowed_origins' ya no admite '*'.
    */
    'supports_credentials' => false,
];
