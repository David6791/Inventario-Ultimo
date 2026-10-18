<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Código de verificación del QR del rótulo (database/sql/cargas/13_verificacion_lote.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('13_verificacion_lote.sql');
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS lote_verificacion_fija ON cargas.lote');
        DB::statement('DROP FUNCTION IF EXISTS cargas.tg_lote_verificacion_fija()');
        DB::statement('ALTER TABLE cargas.lote DROP COLUMN IF EXISTS codigo_verificacion');
    }
};
