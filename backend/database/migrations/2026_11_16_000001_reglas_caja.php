<?php

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sprint 2 — reglas de caja (database/sql/cargas/07_reglas_caja.sql):
 * candados de cajas y conceptos con datos, y la vista previa del número de
 * comprobante con un formato todavía no guardado.
 */
return new class extends Migration
{
    private const TRIGGERS = [
        'caja_control'     => 'caja.caja',
        'concepto_control' => 'caja.concepto',
    ];

    private const FUNCIONES = [
        'caja.tg_caja_control()',
        'caja.tg_concepto_control()',
        'caja.vista_previa_comprobante(varchar, varchar, varchar, bigint, date)',
    ];

    public function up(): void
    {
        ScriptSql::ejecutar('07_reglas_caja.sql');
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
