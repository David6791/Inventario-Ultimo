<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;

/** Cargas — catálogo de bonos; transporte y laboratorio pasan a él (database/sql/cargas/26_catalogo_bonos.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('26_catalogo_bonos.sql');
    }

    public function down(): void
    {
        throw new RuntimeException('Esta migración no se revierte: restaure el respaldo si necesita volver atrás.');
    }
};
