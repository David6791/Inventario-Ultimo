<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Sprint 4 — reglas de recepción (database/sql/cargas/11_recepcion.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('11_recepcion.sql');
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS pesaje_anulado ON cargas.pesaje');
        DB::statement('DROP TRIGGER IF EXISTS lote_anulado_bonos ON cargas.lote');
        DB::statement('DROP FUNCTION IF EXISTS cargas.tg_pesaje_anulado()');
        DB::statement('DROP FUNCTION IF EXISTS cargas.tg_lote_anulado_bonos()');
        DB::statement('DROP FUNCTION IF EXISTS cargas.publicar_tramos_bono(date, jsonb, bigint)');
    }
};
