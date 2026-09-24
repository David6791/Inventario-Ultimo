<?php

namespace App\Providers;

use App\Enums\Permisos;
use App\Models\Role;
use App\Models\User;
use App\Policies\RolePolicy;
use App\Policies\UserPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Gate::policy(Role::class, RolePolicy::class);
        Gate::policy(User::class, UserPolicy::class);

        /*
        | Super-admin: en vez de asignarle los 60 permisos, se responde que sí a
        | todo antes de consultar la tabla. Ventaja concreta: cuando agregues un
        | permiso nuevo al catálogo, el super-admin ya lo tiene sin re-sembrar.
        |
        | Devolver null (no false) es importante: deja que las demás
        | verificaciones sigan su curso para quienes no son super-admin.
        */
        Gate::before(function (User $usuario, string $habilidad) {
            return $usuario->hasRole(Permisos::SUPER_ADMIN) ? true : null;
        });
    }
}
