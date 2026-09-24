<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/*
 | Sin SoftDeletes a propósito.
 |
 | La columna deleted_at existe en la tabla por si algún día hace falta un
 | borrado real de auditoría, pero el estado del producto vive solo en `activo`.
 | Con el trait puesto, los productos dados de baja quedaban excluidos de toda
 | consulta y el filtro "solo dados de baja" devolvía una lista vacía.
 */
class Producto extends Model
{
    use SoftDeletes;
    protected $table = 'productos';

    protected $fillable = [
        'codigo', 'nombre', 'descripcion',
        'categoria_id', 'unidad_medida_id',
        'partida_presupuestaria', 'codigo_barras',
        'stock_minimo', 'stock_maximo',
        'controla_lote', 'controla_vencimiento', 'activo',
    ];

    protected function casts(): array
    {
        return [
            'stock_minimo'         => 'decimal:4',
            'stock_maximo'         => 'decimal:4',
            'controla_lote'        => 'boolean',
            'controla_vencimiento' => 'boolean',
            'activo'               => 'boolean',
        ];
    }

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(Categoria::class);
    }

    public function unidadMedida(): BelongsTo
    {
        return $this->belongsTo(UnidadMedida::class);
    }

    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('activo', true);
    }

    /**
     * Búsqueda por código, nombre o código de barras, sin acentos ni mayúsculas.
     * Es la consulta más usada del sistema: el almacenero escribe parte del
     * nombre y espera resultados mientras tipea.
     */
    public function scopeBuscar(Builder $query, ?string $texto): Builder
    {
        if (blank($texto)) {
            return $query;
        }

        $patron = '%'.mb_strtolower(trim($texto)).'%';

        // La expresion debe coincidir exactamente con la del indice
        // productos_nombre_busqueda, o PostgreSQL no lo usa.
        return $query->where(function (Builder $sub) use ($patron) {
            $sub->whereRaw('lower(inmutable_unaccent(nombre)) like inmutable_unaccent(?)', [$patron])
                ->orWhereRaw('lower(codigo) like ?', [$patron])
                ->orWhereRaw('lower(coalesce(codigo_barras, \'\')) like ?', [$patron]);
        });
    }
}
