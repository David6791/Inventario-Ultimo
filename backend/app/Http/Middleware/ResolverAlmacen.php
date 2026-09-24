<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Determina en qué almacén está operando el usuario en este request y valida
 * que tenga acceso. El almacén llega en el header `X-Almacen-Id` que inyecta el
 * interceptor de Angular; si no viene, se usa el predeterminado del usuario.
 *
 * Se aplica a las rutas de operación (ingresos, salidas, kardex...), no a las de
 * administración de usuarios y roles.
 */
class ResolverAlmacen
{
    public function handle(Request $request, Closure $next): Response
    {
        $usuario = $request->user();

        $almacenId = (int) ($request->header('X-Almacen-Id')
            ?: $usuario?->almacenPredeterminado()?->id);

        abort_if(
            $almacenId === 0,
            409,
            'Su usuario no tiene ningún almacén asignado. Solicite acceso al administrador.'
        );

        abort_unless(
            $usuario->accedeAlmacen($almacenId),
            403,
            'No tiene acceso a este almacén.'
        );

        $request->attributes->set('almacen_id', $almacenId);
        app()->instance('almacen_actual', $almacenId);

        return $next($request);
    }
}
