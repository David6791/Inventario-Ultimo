<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Sprint 3 — la caja se cierra a diario (database/sql/cargas/10_cierre_diario.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('10_cierre_diario.sql');
    }

    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS caja.v_sesion_conceptos');
        DB::statement('DROP TRIGGER IF EXISTS movimiento_dia ON caja.movimiento');
        DB::statement('DROP FUNCTION IF EXISTS caja.tg_movimiento_dia()');
    }
};
