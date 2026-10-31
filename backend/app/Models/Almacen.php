<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Almacen extends Model
{
    use HasFactory;

    protected $table = 'almacenes';

    protected $fillable = ['codigo', 'nombre', 'ubicacion', 'responsable', 'activo'];

    protected function casts(): array
    {
        return ['activo' => 'boolean'];
    }

    public function usuarios(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'usuario_almacen')
            ->withPivot('es_predeterminado')
            ->withTimestamps();
    }

    /**
     * Centro de costo vigente al que pertenece el almacén (cada centro tiene
     * su almacén). Da el nombre del acopio y si es acopio o sede central.
     */
    public function centroCosto(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(\App\Modules\Activos\Models\CentroCosto::class, 'almacen_id')->where('activo', true);
    }

    /** Hay centros de costo marcados como acopio: desde entonces la carga solo entra por ellos. */
    public static function hayAcopios(): bool
    {
        return \Illuminate\Support\Facades\DB::table('activos.centro_costo')->where('es_acopio', true)->where('activo', true)->exists();
    }

    /** Solo los almacenes de acopios (si todavía no se marcó ninguno, todos). */
    public function scopeDeAcopios($query)
    {
        return self::hayAcopios()
            ? $query->whereHas('centroCosto', fn ($c) => $c->where('es_acopio', true))
            : $query;
    }

    public function scopeActivos($query)
    {
        return $query->where('activo', true);
    }
}
