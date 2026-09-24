<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Limita cualquier consulta a los almacenes asignados al usuario autenticado.
 *
 * Se aplica en los modelos que tengan columna `almacen_id` (Stock, Kardex,
 * Ingreso, Salida, ...). Es la última red de seguridad: aunque un controlador
 * olvide filtrar, la consulta ya sale filtrada.
 *
 * Uso en el modelo:
 *   protected static function booted(): void
 *   {
 *       static::addGlobalScope(new AlmacenScope);
 *   }
 */
class AlmacenScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $usuario = auth()->user();

        if (! $usuario || $usuario->can('almacenes.ver-todos')) {
            return;
        }

        $builder->whereIn(
            $model->qualifyColumn('almacen_id'),
            $usuario->almacenesIds()
        );
    }
}
