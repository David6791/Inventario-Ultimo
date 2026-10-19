<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Las migraciones de devoluciones se llamaban 2026_09_23_* y corrían antes
 * que las tablas de las que dependen; se movieron a 2026_12_31_00004x.
 *
 * En una base que ya las tenía con el nombre viejo, Laravel arma la lista de
 * pendientes ANTES de correr esta migración, así que renombrar los registros
 * no evita que las nuevas se ejecuten. Por eso: esta borra los registros
 * viejos y cada migración nueva se salta si su tabla o columna ya existe
 * (queda registrada con el nombre nuevo sin tocar los datos).
 */
return new class extends Migration
{
    private const VIEJAS = [
        '2026_09_23_000001_create_devoluciones_table',
        '2026_09_23_000002_create_devoluciones_detalle_table',
        '2026_09_23_000003_create_devoluciones_consumo_table',
        '2026_09_23_000004_add_devuelto_to_consumos_capa',
    ];

    public function up(): void
    {
        DB::table('migrations')->whereIn('migration', self::VIEJAS)->delete();
    }

    public function down(): void
    {
        // Sin vuelta atrás: los registros nuevos los maneja cada migración.
    }
};
