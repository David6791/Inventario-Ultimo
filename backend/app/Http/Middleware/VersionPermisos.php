<?php

namespace App\Http\Middleware;

use App\Services\VersionPermisosService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VersionPermisos
{
    public function __construct(private VersionPermisosService $version) {}

    public function handle(Request $request, Closure $next): Response
    {
        $respuesta = $next($request);

        $respuesta->headers->set('X-Permisos-Version', $this->version->actual());

        return $respuesta;
    }
}
