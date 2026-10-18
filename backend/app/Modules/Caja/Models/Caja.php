<?php

namespace App\Modules\Caja\Models;

use App\Models\Almacen;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Caja de una sede. El número de comprobante lo arma la base con el formato
 * y el reinicio de la caja (marcadores {CAJA} {AAAA} {AA} {MM} {DD} {N:k}).
 */
class Caja extends CajaModel
{
    protected $table = 'caja.caja';

    protected $fillable = [
        'codigo', 'nombre', 'almacen_id', 'maneja_usd',
        'formato_comprobante', 'reinicio_comprobante', 'activa',
    ];

    protected $casts = [
        'almacen_id' => 'integer',
        'maneja_usd' => 'boolean',
        'activa'     => 'boolean',
    ];

    public const REINICIOS = ['NUNCA', 'ANUAL', 'MENSUAL', 'DIARIO'];

    public const MARCADORES = [
        '{CAJA}' => 'Código de la caja',
        '{AAAA}' => 'Año (2026)',
        '{AA}'   => 'Año corto (26)',
        '{MM}'   => 'Mes (01 a 12)',
        '{DD}'   => 'Día (01 a 31)',
        '{N:6}'  => 'Correlativo con 6 dígitos (cambie el 6)',
    ];

    public function almacen(): BelongsTo
    {
        return $this->belongsTo(Almacen::class, 'almacen_id');
    }

    public function sesiones(): HasMany
    {
        return $this->hasMany(Sesion::class, 'caja_id');
    }

    public function sesionAbierta(): HasOne
    {
        return $this->hasOne(Sesion::class, 'caja_id')->where('estado', Sesion::ABIERTA);
    }

    /** Monedas con las que trabaja: siempre bolivianos, dólares si la caja los maneja. */
    public function monedas(): array
    {
        return $this->maneja_usd ? ['BOB', 'USD'] : ['BOB'];
    }

    public function tieneSesiones(): bool
    {
        return $this->exists && $this->sesiones()->exists();
    }

    /** Usuarios asignados: solo ellos abren, registran, anulan y cierran. */
    public function cajeros(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'caja.caja_cajero', 'caja_id', 'user_id')
            ->withPivot(['asignado_por', 'asignado_en']);
    }

    public function esCajero(User $usuario): bool
    {
        return $this->exists && $this->cajeros()->whereKey($usuario->id)->exists();
    }

    /**
     * Cajas que el usuario puede consultar: las que tiene asignadas y las de
     * sus sedes. Quien administra cajas o ve todos los almacenes, las ve todas.
     */
    public function scopeDelAmbitoDe(Builder $query, User $usuario): Builder
    {
        if ($usuario->can('caja.administrar') || $usuario->can('almacenes.ver-todos')) {
            return $query;
        }

        return $query->where(fn ($q) => $q
            ->whereIn('almacen_id', $usuario->almacenesIds())
            ->orWhereHas('cajeros', fn ($c) => $c->whereKey($usuario->id)));
    }

    public function esDelAmbitoDe(User $usuario): bool
    {
        return $usuario->can('caja.administrar')
            || $usuario->accedeAlmacen($this->almacen_id)
            || $this->esCajero($usuario);
    }
}
