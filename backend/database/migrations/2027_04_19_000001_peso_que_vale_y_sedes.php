<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;

/** Cargas — peso que vale (empresa, cliente o promedio) y sedes de recepción (database/sql/cargas/22_peso_que_vale_y_sedes.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('22_peso_que_vale_y_sedes.sql');
    }

    public function down(): void
    {
        throw new RuntimeException('Esta migración no se revierte: restaure el respaldo si necesita volver atrás.');
    }
};
