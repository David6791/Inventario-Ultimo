<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Centro de costo: la unidad organizativa real de la empresa.
 *
 * Tiene su almacén, su personal y sus ubicaciones. Los activos se imputan a
 * un centro y se asignan a empleados de ese centro.
 *
 * El `almacen_id` es lo que resuelve el ámbito de visibilidad: un usuario ve
 * los activos de los centros cuyos almacenes tiene asignados, reutilizando la
 * relación usuario-almacén que ya existe en el sistema.
 */
class CentroCosto extends ActivoModel
{
    protected $table = 'activos.centro_costo';

    public $timestamps = true;

    protected $fillable = [
        'area_id', 'codigo', 'nombre', 'almacen_id', 'responsable_id', 'activo',
    ];

    protected $casts = [
        'activo'         => 'boolean',
        'area_id'        => 'integer',
        'almacen_id'     => 'integer',
        'responsable_id' => 'integer',
    ];

    public function area(): BelongsTo
    {
        return $this->belongsTo(Area::class, 'area_id');
    }

    public function empleados(): HasMany
    {
        return $this->hasMany(Empleado::class, 'centro_costo_id');
    }

    public function ubicaciones(): HasMany
    {
        return $this->hasMany(Ubicacion::class, 'centro_costo_id');
    }

    public function activos(): HasMany
    {
        return $this->hasMany(Activo::class, 'centro_costo_id');
    }

    /** Quien responde por los bienes del centro. */
    public function responsable(): BelongsTo
    {
        return $this->belongsTo(Empleado::class, 'responsable_id');
    }

    public function scopeVigentes($query)
    {
        return $query->where('activo', true);
    }

    public function scopeDeAlmacenes($query, array $almacenes)
    {
        return $query->whereIn('almacen_id', $almacenes);
    }

    public function getEtiquetaAttribute(): string
    {
        return $this->codigo . ' — ' . $this->nombre;
    }
}
