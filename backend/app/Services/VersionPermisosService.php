<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Spatie\Permission\PermissionRegistrar;

/**
 * Resuelve el problema de las sesiones abiertas: si el administrador cambia los
 * permisos de un rol, los usuarios que ya iniciaron sesión siguen con el arreglo
 * viejo en memoria y ven botones que ya no deberían ver.
 *
 * Cada respuesta de la API lleva el header `X-Permisos-Version`. El interceptor
 * de Angular lo compara con el que tiene guardado y, si difiere, recarga /api/me
 * en segundo plano. Sin websockets ni polling.
 */
class VersionPermisosService
{
    private const CLAVE = 'permisos.version';

    public function actual(): string
    {
        return Cache::rememberForever(self::CLAVE, fn () => (string) now()->getTimestamp());
    }

    /**
     * Se llama después de cualquier cambio en roles o permisos.
     * También limpia el caché interno de Spatie, que es agresivo: sin esto el
     * cambio no surte efecto hasta que expire solo.
     */
    public function invalidar(): void
    {
        Cache::forever(self::CLAVE, (string) now()->getTimestamp());

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
