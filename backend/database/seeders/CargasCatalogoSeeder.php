<?php

namespace Database\Seeders;

use App\Modules\Comun\Support\ScriptSql;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Catálogo inicial de caja y cargas (database/sql/cargas/04_catalogo_inicial.sql):
 * elementos, líneas de producto, series de lote, correlativo de anticipos,
 * sigla de la empresa, retenciones y conceptos de caja que genera cargas.
 *
 * Es estructura, no datos de demostración: se puede correr en producción y
 * es idempotente (ON CONFLICT DO NOTHING), así que el entrypoint lo puede
 * correr en cada arranque.
 */
class CargasCatalogoSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(fn () => ScriptSql::ejecutar('04_catalogo_inicial.sql'));
        $this->command?->info('Catálogo inicial de caja y cargas cargado.');
    }
}
