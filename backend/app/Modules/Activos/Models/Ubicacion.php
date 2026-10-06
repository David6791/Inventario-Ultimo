<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Ubicacion extends ActivoModel
{
    protected $table = 'activos.ubicacion';

    protected $fillable = [
        'codigo', 'nombre', 'centro_costo_id', 'unidad_org_id', 'sucursal',
        'direccion', 'ambiente', 'padre_id', 'activo',
    ];

    protected $casts = [
        'activo'          => 'boolean',
        'centro_costo_id' => 'integer',
        'unidad_org_id'   => 'integer',
        'padre_id'        => 'integer',
    ];

    public function centro(): BelongsTo
    {
        return $this->belongsTo(CentroCosto::class, 'centro_costo_id');
    }

    public function padre(): BelongsTo
    {
        return $this->belongsTo(self::class, 'padre_id');
    }

    public function hijas(): HasMany
    {
        return $this->hasMany(self::class, 'padre_id');
    }

    public function activos(): HasMany
    {
        return $this->hasMany(Activo::class, 'ubicacion_id');
    }

    public function scopeActivas($query)
    {
        return $query->where('activo', true);
    }

    /** Ruta completa: "Oficina Central / Primer piso / Contabilidad". */
    public function getRutaAttribute(): string
    {
        $partes = [$this->nombre];
        $nodo   = $this->padre;

        while ($nodo !== null) {
            array_unshift($partes, $nodo->nombre);
            $nodo = $nodo->padre;
        }

        return implode(' / ', $partes);
    }

    /**
     * Centro efectivo: el propio, o el del primer ancestro que lo tenga.
     * Un edificio entero pertenece al mismo centro, así que basta asignarlo
     * en la raíz y las hijas lo heredan.
     */
    public function getCentroEfectivoAttribute(): ?int
    {
        if ($this->centro_costo_id) {
            return $this->centro_costo_id;
        }

        $nodo = $this->padre;

        while ($nodo !== null) {
            if ($nodo->centro_costo_id) {
                return $nodo->centro_costo_id;
            }
            $nodo = $nodo->padre;
        }

        return null;
    }
}
