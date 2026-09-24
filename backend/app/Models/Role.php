<?php

namespace App\Models;

use App\Enums\Permisos;
use Spatie\Permission\Models\Role as SpatieRole;

/**
 * Extiende el rol de Spatie con los campos propios del sistema.
 * Registrar en config/permission.php:
 *   'models' => ['role' => App\Models\Role::class, ...]
 */
class Role extends SpatieRole
{
    protected $fillable = ['name', 'guard_name', 'descripcion', 'es_sistema'];

    protected function casts(): array
    {
        return ['es_sistema' => 'boolean'];
    }

    public function esSuperAdmin(): bool
    {
        return $this->name === Permisos::SUPER_ADMIN;
    }

    /** Un rol solo se elimina si nadie lo usa y no es de sistema. */
    public function puedeEliminarse(): bool
    {
        return ! $this->es_sistema && $this->users()->count() === 0;
    }

    public function scopeAsignables($query)
    {
        return $query->where('name', '!=', Permisos::SUPER_ADMIN);
    }
}
