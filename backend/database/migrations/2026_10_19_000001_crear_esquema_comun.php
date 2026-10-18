<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;

/**
 * Esquema «comun» desde database/sql/cargas/01_comun.sql.
 * Motor de numeración configurable y bancos. Requiere la extensión btree_gist.
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
        ScriptSql::prepararEsquema('comun', app()->environment(['local', 'testing']));
        ScriptSql::ejecutar('01_comun.sql');
    }

    public function down(): void
    {
        ScriptSql::bajarEsquema('comun', '01_comun.sql');
    }
};
