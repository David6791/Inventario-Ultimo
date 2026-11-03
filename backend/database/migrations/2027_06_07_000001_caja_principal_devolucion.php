<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;

/** Caja — caja principal, devolución del efectivo al cerrar y qué puede pagar cada caja (database/sql/cargas/27_caja_principal_devolucion.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('27_caja_principal_devolucion.sql');
    }

    public function down(): void
    {
        throw new RuntimeException('Esta migración no se revierte: restaure el respaldo si necesita volver atrás.');
    }
};
