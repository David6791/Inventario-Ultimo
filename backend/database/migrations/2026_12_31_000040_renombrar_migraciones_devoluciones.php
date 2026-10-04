<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // 2026_12_31_000040_renombrar_migraciones_devoluciones.php
    public function up(): void
    {
        $renombres = [
            '2026_09_23_000001_create_devoluciones_table'         => '2026_12_31_000041_create_devoluciones_table',
            '2026_09_23_000002_create_devoluciones_detalle_table' => '2026_12_31_000042_create_devoluciones_detalle_table',
            '2026_09_23_000003_create_devoluciones_consumo_table' => '2026_12_31_000043_create_devoluciones_consumo_table',
        ];

        foreach ($renombres as $viejo => $nuevo) {
            DB::table('migrations')->where('migration', $viejo)->update(['migration' => $nuevo]);
        }
}
};