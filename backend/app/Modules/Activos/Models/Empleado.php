<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Personal de la empresa.
 *
 * ES LA ENTIDAD DE CUSTODIA, no el usuario del sistema.
 *
 * Un operario de acopio recibe herramientas y responde por ellas, pero no
 * tiene cuenta. Un almacenero es empleado Y usuario. Si el custodio tuviera
 * que ser un usuario, la mayor parte del personal quedaría fuera.
 *
 * `user_id` vincula a quienes además acceden al sistema. Es opcional y único:
 * una cuenta corresponde a una sola persona.
 */
class Empleado extends ActivoModel
{
    protected $table = 'activos.empleado';

    public $timestamps = true;

    protected $fillable = [
        'codigo', 'nombres', 'apellido_paterno', 'apellido_materno',
        'ci', 'expedido', 'tipo_documento', 'cargo', 'profesion',
        'centro_costo_id', 'fecha_ingreso', 'fecha_baja',
        'telefono', 'movil', 'email', 'direccion',
        'user_id', 'activo', 'observaciones',
    ];

    protected $casts = [
        'fecha_ingreso' => 'date',
        'fecha_baja'    => 'date',
        'activo'        => 'boolean',
        'user_id'       => 'integer',
    ];

    public function centro(): BelongsTo
    {
        return $this->belongsTo(CentroCosto::class, 'centro_costo_id');
    }

    /** Bienes que tiene a su cargo. */
    public function activos(): HasMany
    {
        return $this->hasMany(Activo::class, 'custodio_id');
    }

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }

    public function scopeDelCentro($query, int $centroId)
    {
        return $query->where('centro_costo_id', $centroId);
    }

    /** Solo los que tienen cuenta en el sistema. */
    public function scopeConAcceso($query)
    {
        return $query->whereNotNull('user_id');
    }

    public function getNombreCompletoAttribute(): string
    {
        return trim(implode(' ', array_filter([
            $this->apellido_paterno,
            $this->apellido_materno,
            $this->nombres,
        ])));
    }

    public function getEtiquetaAttribute(): string
    {
        $cargo = $this->cargo ? " — {$this->cargo}" : '';
        return $this->nombre_completo . $cargo;
    }

    public function tieneAcceso(): bool
    {
        return $this->user_id !== null;
    }

    /**
     * Un empleado dado de baja no puede recibir bienes, y antes de darlo de
     * baja hay que descargarle lo que tenga: es el trámite que sostiene el
     * finiquito.
     */
    public function puedeRecibirBienes(): bool
    {
        return $this->activo && $this->fecha_baja === null;
    }

    public function cantidadBienesACargo(): int
    {
        return $this->activos()->where('estado', '<>', 'DADO_DE_BAJA')->count();
    }
}
