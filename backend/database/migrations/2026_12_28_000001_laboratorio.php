<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Sprint 5 — muestreo, análisis y ley final (database/sql/cargas/14_laboratorio.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('14_laboratorio.sql');
    }

    public function down(): void
    {
        foreach (['v_lote_laboratorio', 'v_lote_ensayes'] as $v) {
            DB::statement("DROP VIEW IF EXISTS cargas.{$v}");
        }
        foreach (['lectura_estimada_control ON cargas.lote_lectura_estimada', 'analisis_resultado_control ON cargas.analisis_resultado',
                  'analisis_control ON cargas.analisis', 'muestra_remuestreo ON cargas.muestra', 'lote_ley_historial ON cargas.lote_ley',
                  'muestra_fija ON cargas.muestra', 'muestra_tipo ON cargas.muestra'] as $t) {
            DB::statement("DROP TRIGGER IF EXISTS {$t}");
        }
        DB::statement('DROP TABLE IF EXISTS cargas.lote_lectura_estimada');
        DB::statement('DROP TABLE IF EXISTS cargas.lote_ley_historial');
        foreach (['tg_lectura_estimada_control', 'tg_analisis_resultado_control', 'tg_analisis_control', 'tg_muestra_remuestreo',
                  'tg_lote_ley_historial', 'tg_muestra_fija', 'tg_muestra_tipo'] as $f) {
            DB::statement("DROP FUNCTION IF EXISTS cargas.{$f}()");
        }
        DB::table('cargas.parametro')->where('clave', 'CRITERIO_LEY_DENTRO_LIMITE')->delete();
    }
};
