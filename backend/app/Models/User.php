<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, HasRoles, Notifiable, SoftDeletes;

    /**
     * Clave del asunto: el frontend Angular se autentica con token, o sea bajo
     * el guard `sanctum`. Los permisos de Spatie están "namespaceados" por guard,
     * así que si esto no coincide con el guard_name de los permisos sembrados,
     * toda verificación devuelve 403 sin explicación aparente.
     */
    protected string $guard_name = 'sanctum';

    protected $fillable = [
        'ci', 'name', 'email', 'password', 'cargo', 'telefono',
        'activo', 'debe_cambiar_clave',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at'  => 'datetime',
            'ultimo_acceso_en'   => 'datetime',
            'password'           => 'hashed',
            'activo'             => 'boolean',
            'debe_cambiar_clave' => 'boolean',
        ];
    }

    public function almacenes(): BelongsToMany
    {
        return $this->belongsToMany(Almacen::class, 'usuario_almacen')
            ->withPivot('es_predeterminado')
            ->withTimestamps();
    }

    public function almacenPredeterminado(): ?Almacen
    {
        return $this->almacenes->firstWhere('pivot.es_predeterminado', true)
            ?? $this->almacenes->first();
    }

    /** @return list<int> */
    public function almacenesIds(): array
    {
        return $this->almacenes->pluck('id')->all();
    }

    public function accedeAlmacen(int $almacenId): bool
    {
        return $this->can('almacenes.ver-todos')
            || $this->almacenes->contains('id', $almacenId);
    }

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }
}
