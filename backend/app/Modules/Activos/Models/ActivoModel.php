<?php

namespace App\Modules\Activos\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Base de todos los modelos del módulo.
 *
 * Las tablas viven en el schema `activos`, por eso el nombre va calificado.
 * Si se prefiere no calificar, agregar 'activos' al search_path en
 * config/database.php: 'search_path' => 'public,activos'.
 */
abstract class ActivoModel extends Model
{
    public $timestamps = false;

    protected function schemaTable(string $tabla): string
    {
        return 'activos.' . $tabla;
    }
}
