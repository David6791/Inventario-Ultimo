<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;

/**
 * Esquema «caja» desde database/sql/cargas/02_caja.sql.
 * Depende de public.users, public.almacenes y del esquema comun.
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
        ScriptSql::prepararEsquema('caja', app()->environment(['local', 'testing']));
        ScriptSql::ejecutar('02_caja.sql');
    }

    public function down(): void
    {
        ScriptSql::bajarEsquema('caja', '02_caja.sql');
    }
};
