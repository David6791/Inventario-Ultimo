<?php

use App\Http\Middleware\ResolverAlmacen;
use App\Http\Middleware\VersionPermisos;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            // Alias de spatie/laravel-permission
            'role'               => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission'         => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,

            // Propios
            'version.permisos'   => VersionPermisos::class,
            'almacen'            => ResolverAlmacen::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        /*
        | El frontend necesita respuestas JSON consistentes. Sin esto, un 403 de
        | Spatie llega como HTML y el interceptor de Angular no sabe qué mostrar.
        */
        $exceptions->render(function (\Spatie\Permission\Exceptions\UnauthorizedException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'No tiene permiso para realizar esta acción.',
                    'codigo'  => 'SIN_PERMISO',
                ], 403);
            }
        });

        $exceptions->render(function (\Illuminate\Auth\Access\AuthorizationException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => $e->getMessage() ?: 'No tiene permiso para realizar esta acción.',
                    'codigo'  => 'SIN_PERMISO',
                ], 403);
            }
        });
    })->create();
