<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UnidadMedida extends Model
{
    protected $table = 'unidades_medida';

    protected $fillable = ['codigo', 'nombre', 'permite_decimales', 'activo'];

    protected function casts(): array
    {
        return [
            'permite_decimales' => 'boolean',
            'activo'            => 'boolean',
        ];
    }

    public function productos(): HasMany
    {
        return $this->hasMany(Producto::class);
    }

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }

    public function puedeEliminarse(): bool
    {
        return $this->productos()->count() === 0;
    }
}
