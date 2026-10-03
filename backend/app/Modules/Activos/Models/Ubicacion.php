<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Ubicacion extends ActivoModel
{
    protected $table = 'activos.ubicacion';

    protected $fillable = [
        'codigo', 'nombre', 'unidad_org_id', 'sucursal',
        'direccion', 'ambiente', 'padre_id', 'activo',
    ];

    protected $casts = [
        'activo'        => 'boolean',
        'unidad_org_id' => 'integer',
        'padre_id'      => 'integer',
    ];

    public function padre(): BelongsTo
    {
        return $this->belongsTo(self::class, 'padre_id');
    }

    public function hijas(): HasMany
    {
        return $this->hasMany(self::class, 'padre_id');
    }

    public function scopeActivas($query)
    {
        return $query->where('activo', true);
    }

    /** Ruta completa: "Oficina Central / Piso 2 / Contabilidad". */
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
}
