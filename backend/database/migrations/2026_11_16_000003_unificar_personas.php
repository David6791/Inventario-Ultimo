<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Sprint 2 — unificar personas duplicadas (database/sql/cargas/09_unificar_personas.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('09_unificar_personas.sql');
    }

    public function down(): void
    {
        // Las reglas de los movimientos vuelven a correr siempre (sin WHEN).
        DB::statement('DROP TRIGGER IF EXISTS movimiento_control ON caja.movimiento');
        DB::statement('CREATE TRIGGER movimiento_control BEFORE INSERT OR UPDATE OR DELETE ON caja.movimiento FOR EACH ROW EXECUTE FUNCTION caja.tg_movimiento_control()');
        DB::statement('DROP TRIGGER IF EXISTS movimiento_persona ON caja.movimiento');
        DB::statement('CREATE TRIGGER movimiento_persona BEFORE INSERT OR UPDATE OF persona_id ON caja.movimiento FOR EACH ROW EXECUTE FUNCTION caja.tg_movimiento_persona()');
        DB::statement('DROP TRIGGER IF EXISTS movimiento_cajero ON caja.movimiento');
        DB::statement('CREATE TRIGGER movimiento_cajero BEFORE INSERT OR UPDATE OF estado ON caja.movimiento FOR EACH ROW EXECUTE FUNCTION caja.tg_movimiento_cajero()');
        DB::statement('DROP VIEW IF EXISTS caja.v_persona_homonimos');
        DB::statement('DROP FUNCTION IF EXISTS caja.unificar_personas(bigint, bigint, bigint, text)');
        DB::statement('DROP TABLE IF EXISTS caja.persona_unificacion');
    }
};
