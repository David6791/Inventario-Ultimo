<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Una transferencia involucra dos almacenes, así que el filtro habitual no
 * sirve: la ve quien tenga acceso al origen O al destino.
 *
 * Sin esto, el almacenero del destino no podría confirmar lo que le llega.
 */
class TransferenciaAlmacenScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $usuario = auth()->user();

        if (! $usuario || $usuario->can('almacenes.ver-todos')) {
            return;
        }

        $ids = $usuario->almacenesIds();

        $builder->where(function (Builder $q) use ($model, $ids) {
            $q->whereIn($model->qualifyColumn('almacen_origen_id'), $ids)
              ->orWhereIn($model->qualifyColumn('almacen_destino_id'), $ids);
        });
    }
}
