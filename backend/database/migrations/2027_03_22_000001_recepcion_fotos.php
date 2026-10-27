<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;

/** Cargas — recepción con fotos y OCR: báscula, solo sacos y mixta (database/sql/cargas/20_recepcion_fotos.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('20_recepcion_fotos.sql');
    }

    public function down(): void
    {
        // El peso neto cambia de fórmula y hay fotos ligadas como respaldo: no se revierte solo.
        throw new RuntimeException('Esta migración no se revierte: restaure el respaldo si necesita volver atrás.');
    }
};
