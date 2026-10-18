<?php

namespace Tests\Unit\Comun;

use App\Modules\Comun\Exceptions\ErrorBaseDatos;
use App\Modules\Comun\Support\ScriptSql;
use Database\Seeders\CajaCargasRolesSeeder;
use PDOException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * Pruebas sin base de datos. Los textos de error son los que PostgreSQL 16
 * devolvió de verdad por PDO al violar cada regla.
 */
class ErrorBaseDatosTest extends TestCase
{
    private static function pdo(string $sqlstate, string $texto): PDOException
    {
        $e = new PDOException("SQLSTATE[{$sqlstate}]: {$texto}");
        $e->errorInfo = [$sqlstate, 7, $texto];

        return $e;
    }

    public static function casos(): array
    {
        return [
            'raise de trigger' => [
                'P0001',
                "ERROR:  El formato solo puede tener un correlativo {N}.\nCONTEXT:  PL/pgSQL function comun.validar_formato(character varying,character varying,text[]) line 41 at RAISE",
                'El formato solo puede tener un correlativo {N}.',
                'P0001',
            ],
            'check con nombre' => [
                '23514',
                "ERROR:  new row for relation \"productor\" violates check constraint \"ck_productor_identificacion\"\nDETAIL:  Failing row contains (5, PARTICULAR, x, null).",
                'Indique el CI o el NIT del productor.',
                'ck_productor_identificacion',
            ],
            'unique automático' => [
                '23505',
                "ERROR:  duplicate key value violates unique constraint \"elemento_codigo_key\"\nDETAIL:  Key (codigo)=(ZN) already exists.",
                'Ya existe un elemento con ese código.',
                'elemento_codigo_key',
            ],
            'índice único normalizado' => [
                '23505',
                "ERROR:  duplicate key value violates unique constraint \"ux_cooperativa_nombre\"\nDETAIL:  Key (upper(...))=(COOP A) already exists.",
                'Ya existe una cooperativa con ese nombre.',
                'ux_cooperativa_nombre',
            ],
            'exclusión de vigencias' => [
                '23P01',
                "ERROR:  conflicting key value violates exclusion constraint \"ex_rt_solape\"\nDETAIL:  Key (...) conflicts with existing key (...).",
                'Ya hay una tasa de esa retención vigente en esas fechas: cierre la vigencia anterior primero.',
                'ex_rt_solape',
            ],
            'not null' => [
                '23502',
                "ERROR:  null value in column \"lote_id\" of relation \"anticipo\" violates not-null constraint\nDETAIL:  Failing row contains (...).",
                'Falta un dato obligatorio: «lote id».',
                '23502',
            ],
            'clave foránea al insertar' => [
                '23503',
                "ERROR:  insert or update on table \"mina\" violates foreign key constraint \"mina_cooperativa_id_fkey\"\nDETAIL:  Key (cooperativa_id)=(999999) is not present in table \"cooperativa\".",
                'El registro relacionado no existe.',
                'mina_cooperativa_id_fkey',
            ],
            'regla diferida al confirmar' => [
                'P0001',
                "ERROR:  El comprobante CZ-2026-000001 es un pago de anticipo pero no está vinculado a ningún anticipo de un lote.\nCONTEXT:  PL/pgSQL function cargas.tg_mov_caja_vinculado() line 11 at RAISE",
                'El comprobante CZ-2026-000001 es un pago de anticipo pero no está vinculado a ningún anticipo de un lote.',
                'P0001',
            ],
            'restricción en español (lc_messages es_*)' => [
                '23514',
                "ERROR:  el nuevo registro para la relación «pesaje» viola la restricción «check» «ck_pesaje_pesos»",
                'El peso bruto debe ser mayor que la tara, y la tara no puede ser negativa.',
                'ck_pesaje_pesos',
            ],
        ];
    }

    #[DataProvider('casos')]
    public function test_traduce_el_error(string $sqlstate, string $texto, string $mensaje, string $codigo): void
    {
        $error = ErrorBaseDatos::desde(self::pdo($sqlstate, $texto));

        $this->assertNotNull($error);
        $this->assertSame($mensaje, $error->mensaje);
        $this->assertSame($codigo, $error->aArreglo()['codigo']);
    }

    public function test_los_errores_que_no_son_reglas_quedan_como_500(): void
    {
        $this->assertNull(ErrorBaseDatos::desde(self::pdo('08006', 'could not connect to server')));
        $this->assertNull(ErrorBaseDatos::desde(self::pdo('42601', 'ERROR:  syntax error at or near "selec"')));
        $this->assertNull(ErrorBaseDatos::desde(new RuntimeException('otra cosa')));
    }

    public function test_lee_el_error_envuelto_en_otra_excepcion(): void
    {
        $envuelta = new RuntimeException('envoltorio', 0, self::pdo('23505', 'ERROR:  duplicate key value violates unique constraint "uq_pesaje_ticket"'));

        $this->assertSame('Ese ticket de báscula ya está registrado.', ErrorBaseDatos::desde($envuelta)?->mensaje);
    }

    public function test_script_sql_quita_solo_el_control_de_transaccion_de_nivel_superior(): void
    {
        $sql = "\\set ON_ERROR_STOP on\nBEGIN;\nCREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS \$\$\nBEGIN\n    BEGIN\n        PERFORM 1;\n    END;\nEND \$\$;\nCOMMIT;\nROLLBACK;\n";
        $limpio = ScriptSql::limpiar($sql);

        $this->assertStringNotContainsString('\\set', $limpio);
        $this->assertStringNotContainsString("BEGIN;\n", $limpio);
        $this->assertStringNotContainsString('COMMIT;', $limpio);
        $this->assertStringNotContainsString('ROLLBACK;', $limpio);
        $this->assertSame(2, substr_count($limpio, 'BEGIN'), 'Los BEGIN de PL/pgSQL deben quedar.');
        $this->assertStringContainsString('    END;', $limpio);
    }

    public function test_ningun_rol_rompe_la_segregacion_de_funciones(): void
    {
        CajaCargasRolesSeeder::verificarSegregacion();
        $this->addToAssertionCount(1);
    }
}
