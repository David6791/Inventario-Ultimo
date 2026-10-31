<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;

/** Cargas — centros de costo como unidad: acopios y sede central (database/sql/cargas/24_centros_costo_acopios.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('24_centros_costo_acopios.sql');
    }

    public function down(): void
    {
        throw new RuntimeException('Esta migración no se revierte: restaure el respaldo si necesita volver atrás.');
    }
};
