<?php

namespace Tests\Feature\Cargas;

use App\Modules\Comun\Exceptions\ErrorBaseDatos;
use App\Modules\Comun\Support\ScriptSql;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use LogicException;
use Tests\TestCase;

/**
 * Las reglas del modelo viven en la base. Esta prueba corre las 122
 * verificaciones de database/sql/cargas/05_pruebas.sql: si una regla se
 * rompe, el script lanza «FALLA: …» y la prueba falla con ese mensaje.
 */
class ReglasBaseDatosTest extends TestCase
{
    use PreparaBaseCargas;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
    }

    public function test_las_122_reglas_del_modelo_se_cumplen(): void
    {
        // RefreshDatabase ya abrió una transacción; el script no trae BEGIN/ROLLBACK
        // (ScriptSql los quita) y todo se descarta al terminar la prueba.
        DB::unprepared(ScriptSql::leer(ScriptSql::ruta('05_pruebas.sql')));

        $this->assertSame(1, DB::selectOne(
            "select count(*) as n from cargas.lote where codigo = 'CZP-202610-0001'"
        )->n, 'El script no llegó a crear el primer lote.');

        $this->assertSame(2, DB::selectOne(
            "select count(*) as n from caja.sesion s join caja.caja c on c.id = s.caja_id where c.codigo = 'CP'"
        )->n, 'El script no llegó a la segunda apertura de caja (última sección).');
    }

    public function test_la_transaccion_identifica_al_usuario_ante_la_base(): void
    {
        $visto = Transaccion::como(2, fn () => DB::selectOne(
            "select current_setting('cargas.usuario_id', true) as u"
        )->u);

        $this->assertSame('2', $visto);
    }

    public function test_sin_usuario_no_hay_transaccion(): void
    {
        $this->expectException(LogicException::class);
        Transaccion::como(null, fn () => null);
    }

    public function test_un_pago_de_anticipo_sin_lote_se_rechaza_con_mensaje_en_espanol(): void
    {
        DB::insert("insert into caja.caja (codigo, nombre, almacen_id) values ('PR', 'Caja de prueba', 1)");
        DB::insert("insert into caja.caja_cajero (caja_id, user_id) select id, 1 from caja.caja where codigo = 'PR'");
        DB::insert("insert into caja.sesion (caja_id, abierta_por) select id, 1 from caja.caja where codigo = 'PR'");
        DB::insert("insert into caja.sesion_saldo (sesion_id, moneda, saldo_inicial)
                    select s.id, 'BOB', 1000 from caja.sesion s join caja.caja c on c.id = s.caja_id where c.codigo = 'PR'");
        DB::insert("insert into caja.movimiento (sesion_id, concepto_id, monto, persona_nombre, glosa, registrado_por, caja_id, numero, tipo)
                    select s.id, k.id, 100, 'Alguien', 'Anticipo suelto', 1, 0, 'x', 'x'
                      from caja.sesion s join caja.caja c on c.id = s.caja_id, caja.concepto k
                     where c.codigo = 'PR' and k.codigo = 'ANTICIPO_COMPRA'");

        try {
            // La regla es diferida (se revisa al confirmar); dentro de la prueba la forzamos.
            DB::statement('SET CONSTRAINTS ALL IMMEDIATE');
            $this->fail('La base debió rechazar el egreso de anticipo sin vincular.');
        } catch (QueryException $e) {
            $error = ErrorBaseDatos::desde($e);
            $this->assertNotNull($error);
            $this->assertSame('P0001', $error->sqlstate);
            $this->assertStringContainsString('no está vinculado a ningún anticipo de un lote', $error->mensaje);
        }
    }
}
