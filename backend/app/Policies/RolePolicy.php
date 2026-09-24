<?php

namespace App\Policies;

use App\Models\Role;
use App\Models\User;

class RolePolicy
{
    public function viewAny(User $usuario): bool
    {
        return $usuario->can('roles.ver');
    }

    public function view(User $usuario, Role $rol): bool
    {
        return $usuario->can('roles.ver');
    }

    public function create(User $usuario): bool
    {
        return $usuario->can('roles.crear');
    }

    public function update(User $usuario, Role $rol): bool
    {
        if (! $usuario->can('roles.editar')) {
            return false;
        }

        // El rol super-admin no se toca: sus permisos se resuelven por Gate::before.
        if ($rol->esSuperAdmin()) {
            return false;
        }

        // Nadie edita el rol que él mismo tiene asignado. Es la forma más común
        // de quedarse fuera del sistema sin querer.
        if ($usuario->hasRole($rol->name) && ! $usuario->hasRole(\App\Enums\Permisos::SUPER_ADMIN)) {
            return false;
        }

        return true;
    }

    public function delete(User $usuario, Role $rol): bool
    {
        return $usuario->can('roles.eliminar') && $rol->puedeEliminarse();
    }
}
