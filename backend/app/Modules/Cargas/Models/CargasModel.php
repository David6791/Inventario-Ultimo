<?php

namespace App\Modules\Cargas\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Modelo base del esquema «cargas». Todos los modelos del módulo heredan de él.
 *
 * Igual que ActivoModel: con $table = 'cargas.tabla', Eloquent puede leer
 * «cargas» como nombre de conexión y fallar con «Database connection [cargas] not
 * configured». Fijar la conexión explícitamente lo evita.
 *
 * A diferencia de ActivoModel, aquí $timestamps queda en true: las tablas de
 * estos esquemas tienen created_at y updated_at.
 *
 * Recordatorios del módulo de activos:
 * - Rule::unique(Modelo::class, 'columna'), nunca Rule::unique('cargas.tabla', ...).
 * - Las tablas sin created_at/updated_at declaran public $timestamps = false.
 * - Muchas columnas las fija la base (código, estado inicial, tipo, monto del
 *   bono…): después de crear, usar ->refresh() para leer lo que quedó guardado.
 */
abstract class CargasModel extends Model
{
    public function getConnectionName(): ?string
    {
        return config('database.default');
    }
}
