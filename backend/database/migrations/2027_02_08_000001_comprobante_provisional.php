<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Caja — comprobantes provisionales y ajuste del monto en el día (database/sql/cargas/18_comprobante_provisional.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('18_comprobante_provisional.sql');
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS sesion_sin_provisionales ON caja.sesion');
        DB::statement('DROP FUNCTION IF EXISTS caja.tg_sesion_sin_provisionales()');
        DB::statement('DROP FUNCTION IF EXISTS caja.validar_movimiento(bigint, bigint)');
        DB::statement('DROP FUNCTION IF EXISTS caja.resolver_ajuste(bigint, boolean, text, bigint)');
        DB::statement('DROP FUNCTION IF EXISTS caja.ajustar_movimiento(bigint, numeric, text, text, bigint)');
        DB::statement('DROP FUNCTION IF EXISTS caja.aplicar_ajuste(bigint, bigint)');
        DB::statement('DROP FUNCTION IF EXISTS caja.exigir_provisional_del_dia(bigint)');
        DB::statement('DROP TRIGGER IF EXISTS movimiento_anula_ajustes ON caja.movimiento');
        DB::statement('DROP FUNCTION IF EXISTS caja.tg_movimiento_anula_ajustes()');
        DB::statement('DROP TRIGGER IF EXISTS movimiento_provisional ON caja.movimiento');
        DB::statement('DROP FUNCTION IF EXISTS caja.tg_movimiento_provisional()');
        DB::statement('DROP TABLE IF EXISTS caja.movimiento_ajuste');
        DB::statement('DROP FUNCTION IF EXISTS caja.tg_ajuste_solo_funciones()');
        DB::statement('ALTER TABLE caja.movimiento DROP CONSTRAINT IF EXISTS ck_mov_validado');
        DB::statement('DROP INDEX IF EXISTS caja.ix_mov_provisional');
        DB::statement('ALTER TABLE caja.movimiento DROP COLUMN IF EXISTS validado_en, DROP COLUMN IF EXISTS validado_por, DROP COLUMN IF EXISTS provisional');
        // tg_movimiento_control queda con el ajuste habilitado: sin las columnas ni las funciones, no se usa.
    }
};
