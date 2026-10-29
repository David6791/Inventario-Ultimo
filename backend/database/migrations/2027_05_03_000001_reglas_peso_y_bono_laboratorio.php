<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;

/** Cargas — reglas de peso con fórmula, peso del cliente con bruto y tara, y bono de laboratorio (database/sql/cargas/23_reglas_peso_y_bono_laboratorio.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('23_reglas_peso_y_bono_laboratorio.sql');
    }

    public function down(): void
    {
        throw new RuntimeException('Esta migración no se revierte: restaure el respaldo si necesita volver atrás.');
    }
};
