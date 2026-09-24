<?php

namespace App\Policies;

use App\Enums\Permisos;
use App\Models\User;

class UserPolicy
{
    public function viewAny(User $usuario): bool
    {
        return $usuario->can('usuarios.ver');
    }

    public function view(User $usuario, User $destino): bool
    {
        return $usuario->can('usuarios.ver');
    }

    public function create(User $usuario): bool
    {
        return $usuario->can('usuarios.crear');
    }

    public function update(User $usuario, User $destino): bool
    {
        if (! $usuario->can('usuarios.editar')) {
            return false;
        }

        // Solo un super-admin edita a otro super-admin.
        if ($destino->hasRole(Permisos::SUPER_ADMIN) && ! $usuario->hasRole(Permisos::SUPER_ADMIN)) {
            return false;
        }

        return true;
    }

    /** Desactivar, no borrar: los movimientos de inventario referencian al usuario. */
    public function desactivar(User $usuario, User $destino): bool
    {
        if (! $usuario->can('usuarios.desactivar')) {
            return false;
        }

        // Nadie se desactiva a sí mismo.
        if ($usuario->is($destino)) {
            return false;
        }

        return ! $destino->hasRole(Permisos::SUPER_ADMIN)
            || $usuario->hasRole(Permisos::SUPER_ADMIN);
    }

    public function asignarAlmacenes(User $usuario, User $destino): bool
    {
        return $usuario->can('usuarios.asignar-almacenes');
    }

    public function restablecerClave(User $usuario, User $destino): bool
    {
        return $usuario->can('usuarios.restablecer-clave') && ! $usuario->is($destino);
    }
}
