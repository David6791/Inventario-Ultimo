<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Sprint 6 — precios, cotizaciones, retenciones y valor estimado (database/sql/cargas/16_precios.sql). */
return new class extends Migration
{
    public function up(): void
    {
        ScriptSql::ejecutar('16_precios.sql');
    }

    public function down(): void
    {
        DB::statement('DROP FUNCTION IF EXISTS cargas.valor_estimado_lote(bigint)');
        DB::statement('DROP TRIGGER IF EXISTS cotizacion_cambio ON cargas.cotizacion');
        DB::statement('DROP FUNCTION IF EXISTS cargas.tg_cotizacion_cambio()');
        DB::statement('DROP TABLE IF EXISTS cargas.cotizacion_cambio');
        DB::statement('DROP FUNCTION IF EXISTS cargas.retencion_vigente(varchar, bigint, date)');
        DB::statement('DROP FUNCTION IF EXISTS cargas.publicar_tasa_retencion(bigint, bigint, numeric, date, bigint)');
        DB::statement('DROP TRIGGER IF EXISTS tabla_precio_anular ON cargas.tabla_precio');
        DB::statement('DROP FUNCTION IF EXISTS cargas.tg_tabla_precio_anular()');
        DB::statement('DROP FUNCTION IF EXISTS cargas.aprobar_tabla_precio(bigint, bigint)');
    }
};
