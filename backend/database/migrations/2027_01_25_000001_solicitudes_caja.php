<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Caja — próximo comprobante, cajas con aprobación y solicitudes de dinero (database/sql/cargas/17_solicitudes_caja.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('17_solicitudes_caja.sql');
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS caja_aprobacion ON caja.caja');
        DB::statement('DROP FUNCTION IF EXISTS caja.tg_caja_aprobacion()');
        DB::statement('DROP TRIGGER IF EXISTS movimiento_solicitud_estado ON caja.movimiento');
        DB::statement('DROP FUNCTION IF EXISTS caja.tg_movimiento_solicitud_estado()');
        DB::statement('DROP TRIGGER IF EXISTS movimiento_a_solicitud ON caja.movimiento');
        DB::statement('DROP FUNCTION IF EXISTS caja.tg_movimiento_solicitud()');
        DB::statement('ALTER TABLE caja.solicitud DROP CONSTRAINT IF EXISTS fk_sol_movimiento');
        DB::statement('ALTER TABLE caja.movimiento DROP COLUMN IF EXISTS solicitud_id');
        DB::statement('DROP TABLE IF EXISTS caja.solicitud');
        DB::statement('DROP FUNCTION IF EXISTS caja.tg_solicitud_control()');
        DB::statement('DROP FUNCTION IF EXISTS caja.es_aprobador(bigint, bigint)');
        DB::statement('DROP TABLE IF EXISTS caja.caja_aprobador');
        DB::statement('ALTER TABLE caja.concepto DROP COLUMN IF EXISTS exento_aprobacion');
        DB::statement('ALTER TABLE caja.caja DROP COLUMN IF EXISTS requiere_aprobacion');
        DB::statement('DROP FUNCTION IF EXISTS caja.fijar_proximo_comprobante(bigint, integer, bigint, text)');
        DB::statement('DROP FUNCTION IF EXISTS caja.ultimo_comprobante(bigint, date)');
        DB::statement('DROP TABLE IF EXISTS caja.ajuste_numeracion');
        DB::statement("DELETE FROM comun.contador WHERE clave = 'caja.solicitud'");
    }
};
