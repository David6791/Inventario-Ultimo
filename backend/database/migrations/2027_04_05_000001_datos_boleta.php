<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;

/** Cargas — N.º de orden y fecha de la boleta en el pesaje (database/sql/cargas/21_datos_boleta.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('21_datos_boleta.sql');
    }

    public function down(): void
    {
        throw new RuntimeException('Esta migración no se revierte: restaure el respaldo si necesita volver atrás.');
    }
};
