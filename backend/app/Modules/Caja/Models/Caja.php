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
        'formato_comprobante', 'reinicio_comprobante', 'activa', 'requiere_aprobacion',
        'numeracion_separada', 'inicio_egreso', 'inicio_ingreso', 'formato_ingreso',
    ];

    protected $casts = [
        'almacen_id' => 'integer',
        'maneja_usd' => 'boolean',
        'activa'     => 'boolean',
        'requiere_aprobacion' => 'boolean',
        'numeracion_separada' => 'boolean',
        'inicio_egreso'       => 'integer',
        'inicio_ingreso'      => 'integer',
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

    /** Usuarios que aprueban o rechazan las solicitudes de dinero de esta caja. */
    public function aprobadores(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'caja.caja_aprobador', 'caja_id', 'user_id')
            ->withPivot(['asignado_por', 'asignado_en']);
    }

    public function esAprobador(User $usuario): bool
    {
        return $this->exists && $this->aprobadores()->whereKey($usuario->id)->exists();
    }

    public function solicitudes(): HasMany
    {
        return $this->hasMany(Solicitud::class, 'caja_id');
    }

    /**
     * Cajas que el usuario puede consultar:
     *  - quien administra cajas o ve todos los almacenes: todas;
     *  - quien supervisa (valida cierres o ve reportes): las de sus sedes y las suyas;
     *  - el cajero y el aprobador: solo las que tiene asignadas, aunque haya
     *    otras cajas en su sede.
     */
    public static function veCajasDeSusSedes(User $usuario): bool
    {
        return $usuario->can('caja.validar') || $usuario->can('caja.reportes');
    }

    public function scopeDelAmbitoDe(Builder $query, User $usuario): Builder
    {
        if ($usuario->can('caja.administrar') || $usuario->can('almacenes.ver-todos')) {
            return $query;
        }

        return $query->where(function ($q) use ($usuario) {
            $q->whereHas('cajeros', fn ($c) => $c->whereKey($usuario->id))
              ->orWhereHas('aprobadores', fn ($c) => $c->whereKey($usuario->id));
            if (self::veCajasDeSusSedes($usuario)) {
                $q->orWhereIn('almacen_id', $usuario->almacenesIds());
            }
        });
    }

    public function esDelAmbitoDe(User $usuario): bool
    {
        return $usuario->can('caja.administrar') || $usuario->can('almacenes.ver-todos')
            || $this->esCajero($usuario)
            || $this->aprobadores()->whereKey($usuario->id)->exists()
            || (self::veCajasDeSusSedes($usuario) && $usuario->accedeAlmacen($this->almacen_id));
    }
}
