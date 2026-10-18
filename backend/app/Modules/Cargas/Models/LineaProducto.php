<?php

namespace App\Modules\Cargas\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

/** Qué producto es (carga, brosa, concentrado, sacos) y cómo se paga. */
class LineaProducto extends CargasModel
{
    protected $table = 'cargas.linea_producto';

    protected $fillable = ['codigo', 'nombre', 'forma', 'modalidad_precio', 'activa'];

    protected $casts = ['activa' => 'boolean'];

    public const FORMAS = ['CARGA', 'BROSA', 'CONCENTRADO', 'SACOS'];

    public const MODALIDADES = [
        'POR_PUNTO'              => 'Ley × precio por punto',
        'POR_PORCENTAJE'         => 'Ley × % pagable × cotización',
        'VALORACION_CONCENTRADO' => 'Valoración de concentrado',
    ];

    public function elementos(): HasMany
    {
        return $this->hasMany(LineaProductoElemento::class, 'linea_producto_id');
    }

    public function series(): HasMany
    {
        return $this->hasMany(SerieLote::class, 'linea_producto_id');
    }
}
