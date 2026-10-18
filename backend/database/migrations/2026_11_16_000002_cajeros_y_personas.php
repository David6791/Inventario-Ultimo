<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sprint 2 — cajeros asignados por caja y registro de personas
 * (database/sql/cargas/08_cajeros_personas.sql).
 */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('08_cajeros_personas.sql');
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS movimiento_persona ON caja.movimiento');
        DB::statement('DROP TRIGGER IF EXISTS movimiento_cajero ON caja.movimiento');
        DB::statement('DROP TRIGGER IF EXISTS sesion_cajero ON caja.sesion');
        DB::statement('DROP VIEW IF EXISTS caja.v_persona_resumen');
        DB::statement('ALTER TABLE caja.movimiento DROP COLUMN IF EXISTS persona_id');
        foreach ([
            'caja.tg_movimiento_persona()', 'caja.tg_movimiento_cajero()', 'caja.tg_sesion_cajero()',
            'caja.registrar_persona(text, text)', 'caja.normalizar_nombre(text)',
            'caja.exigir_cajero(bigint, bigint, text)', 'caja.es_cajero(bigint, bigint)',
        ] as $funcion) {
            DB::statement("DROP FUNCTION IF EXISTS {$funcion}");
        }
        DB::statement('DROP TABLE IF EXISTS caja.persona');
        DB::statement('DROP TABLE IF EXISTS caja.caja_cajero');
    }
};
