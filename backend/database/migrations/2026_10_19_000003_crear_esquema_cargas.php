<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;

/**
 * Esquema «cargas» desde database/sql/cargas/03_cargas.sql.
 * Depende de public.users, public.almacenes, comun y caja. Agrega triggers sobre caja.movimiento (se borran con el esquema).
 *
 * El SQL es la fuente única del modelo (ya probado con 05_pruebas.sql); por eso
 * no se reescribe con Schema::create. Para cambiar el modelo después de
 * desplegar: migración nueva con el ALTER correspondiente, nunca editar el
 * script de una migración ya ejecutada en producción.
 */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::prepararEsquema('cargas', app()->environment(['local', 'testing']));
        ScriptSql::ejecutar('03_cargas.sql');
    }

    public function down(): void
    {
        ScriptSql::bajarEsquema('cargas', '03_cargas.sql');
    }
};
