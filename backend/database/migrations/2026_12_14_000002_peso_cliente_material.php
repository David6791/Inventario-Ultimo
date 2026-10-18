<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Peso declarado por el cliente y material del lote (database/sql/cargas/12_peso_cliente_material.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('12_peso_cliente_material.sql');
    }

    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS cargas.v_lote_peso_cliente');
        DB::statement('ALTER TABLE cargas.lote DROP COLUMN IF EXISTS material');
        DB::statement('ALTER TABLE cargas.pesaje DROP COLUMN IF EXISTS peso_cliente_kg');
    }
};
