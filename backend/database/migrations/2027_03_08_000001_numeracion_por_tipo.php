<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;

/** Caja — numeración separada para ingresos y egresos (database/sql/cargas/19_numeracion_por_tipo.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('19_numeracion_por_tipo.sql');
    }

    public function down(): void
    {
        // Sin vuelta atrás automática: la numeración ya emitida depende de estas funciones.
        throw new RuntimeException('Esta migración no se revierte: restaure el respaldo si necesita volver atrás.');
    }
};
