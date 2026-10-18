<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sprint 1 — reglas de catálogos (database/sql/cargas/06_reglas_catalogos.sql):
 * candados para series, elementos, líneas y minas que ya tienen datos, la
 * vista previa de un formato sin guardar y la opción de continuar la
 * numeración de otro sistema.
 *
 * Primera migración que CAMBIA un esquema ya desplegado: por eso es un archivo
 * nuevo y no una edición de 03_cargas.sql.
 */
return new class extends Migration
{
    private const TRIGGERS = [
        'serie_lote_con_lotes'   => 'cargas.serie_lote',
        'elemento_control'       => 'cargas.elemento',
        'linea_producto_control' => 'cargas.linea_producto',
        'mina_con_lotes'         => 'cargas.mina',
    ];

    private const FUNCIONES = [
        'cargas.tg_serie_lote_con_lotes()',
        'cargas.tg_elemento_control()',
        'cargas.tg_linea_producto_control()',
        'cargas.tg_mina_con_lotes()',
        'cargas.vista_previa_formato_lote(varchar, varchar, varchar, bigint, varchar, date, bigint)',
        'cargas.fijar_ultimo_numero_serie(bigint, integer, date)',
    ];

    public function up(): void
    {
        ScriptSql::ejecutar('06_reglas_catalogos.sql');
    }

    public function down(): void
    {
        foreach (self::TRIGGERS as $trigger => $tabla) {
            DB::statement("DROP TRIGGER IF EXISTS {$trigger} ON {$tabla}");
        }

        foreach (self::FUNCIONES as $funcion) {
            DB::statement("DROP FUNCTION IF EXISTS {$funcion}");
        }
    }
};
