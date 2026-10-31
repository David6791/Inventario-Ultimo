<?php

namespace Tests\Feature\Cargas;

use App\Models\User;
use App\Modules\Caja\Models\Caja;
use App\Modules\Cargas\Models\Bocamina;
use App\Modules\Cargas\Models\Cooperativa;
use App\Modules\Cargas\Models\Mina;
use App\Modules\Cargas\Models\Municipio;
use App\Modules\Cargas\Models\Productor;
use App\Modules\Cargas\Models\SerieLote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Reglas del peso que vale con fórmula, peso del cliente con bruto y tara, y
 * bono de laboratorio por elementos (tabla, pago por caja a quien cobra y
 * suma de lo adelantado por lote).
 */
class ReglasPesoYBonoLaboratorioApiTest extends TestCase
{
    use PreparaBaseCargas;
    use RefreshDatabase;

    private const RECEPCION = ['cargas.ver', 'cargas.recibir'];
    private const CAJERO = ['caja.ver', 'caja.abrir', 'caja.registrar', 'caja.pagar-bono'];

    private Productor $productor;
    private Cooperativa $cooperativa;
    private Mina $minaCoop;
    private Mina $minaPropia;
    private Bocamina $bocamina;
    private Municipio $municipio;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
        $this->filaConId('almacenes', 2);

        $this->municipio = Municipio::create(['codigo' => '050601', 'nombre' => 'PORCO', 'departamento' => 'POTOSI']);
        $this->cooperativa = Cooperativa::create(['nombre' => 'COOPERATIVA MINERA PORCO LTDA.', 'municipio_id' => $this->municipio->id]);
        $this->productor = Productor::create(['tipo' => 'COOPERATIVISTA', 'nombre' => 'JUAN MAMANI', 'ci' => '4455667', 'cooperativa_id' => $this->cooperativa->id]);
        $this->minaCoop = Mina::create(['nombre' => 'SANTA ROSA', 'cooperativa_id' => $this->cooperativa->id, 'municipio_id' => $this->municipio->id]);
        $this->minaPropia = Mina::create(['nombre' => 'MINA PORCO', 'propia' => true, 'municipio_id' => $this->municipio->id]);
        $this->bocamina = Bocamina::create(['mina_id' => $this->minaPropia->id, 'codigo' => 'BM-03', 'nombre' => 'Nivel 3']);

        DB::table('cargas.bono_transporte_tramo')->insert([
            ['tipo_vehiculo' => 'TONKA',    'peso_desde_kg' => 500,  'peso_hasta_kg' => 7000,  'monto' => 50,  'vigente_desde' => '2026-01-01'],
            ['tipo_vehiculo' => 'SENCILLO', 'peso_desde_kg' => 7000, 'peso_hasta_kg' => 10000, 'monto' => 80,  'vigente_desde' => '2026-01-01'],
            ['tipo_vehiculo' => 'DOBLE',    'peso_desde_kg' => 10000, 'peso_hasta_kg' => null, 'monto' => 100, 'vigente_desde' => '2026-01-01'],
        ]);
    }

    private function usuario(array $permisos, array $almacenes = [1]): User
    {
        $u = User::factory()->create();
        $u->givePermissionTo($permisos);
        $u->almacenes()->sync($almacenes);

        return $u;
    }

    private function como(User $u): User
    {
        Sanctum::actingAs($u->fresh());

        return $u;
    }

    private function serie(string $prefijo): int
    {
        return SerieLote::where('prefijo', $prefijo)->value('id');
    }

    private function pesaje(array $cambios = []): array
    {
        return ['bascula' => 'Potosí 1', 'ticket' => 't-100', 'peso_bruto_kg' => 12500, 'tara_kg' => 4300,
                'num_sacos' => 160, 'placa' => '1234 abc', 'chofer_nombre' => 'pedro  quispe', 'chofer_ci' => '778899', ...$cambios];
    }

    private function recibir(array $cambios = [], ?array $pesaje = null): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/cargas/lotes', [
            'serie_id' => $this->serie('CZP'), 'almacen_id' => 1, 'productor_id' => $this->productor->id,
            'mina_id' => $this->minaCoop->id, 'guia_transporte' => 'g-123', 'pesaje' => $pesaje ?? $this->pesaje(), ...$cambios,
        ]);
    }

    /** Caja abierta en la sede 1 con un cajero asignado. */
    private function cajaAbierta(float $saldo = 1000, int $almacen = 1, string $codigo = 'PTS'): array
    {
        $caja = Caja::create(['codigo' => $codigo, 'nombre' => "Caja {$codigo}", 'almacen_id' => $almacen,
            'formato_comprobante' => '{CAJA}-{AAAA}-{N:5}', 'reinicio_comprobante' => 'ANUAL']);
        $cajero = $this->usuario(self::CAJERO, [$almacen]);
        DB::table('caja.caja_cajero')->insert(['caja_id' => $caja->id, 'user_id' => $cajero->id]);
        $this->como($cajero);
        $this->postJson("/api/caja/cajas/{$caja->id}/sesiones", ['saldo_inicial' => ['BOB' => $saldo]])->assertCreated();

        return [$caja, $cajero];
    }

    private const CONFIG = ['cargas.ver', 'cargas.catalogos', 'cargas.configurar-bono'];

    private function tablaLaboratorio(): void
    {
        $this->como($this->usuario(self::CONFIG));
        $this->postJson('/api/cargas/bono-laboratorio-tramos', ['vigente_desde' => now()->toDateString(), 'tramos' => [
            ['num_elementos' => 1, 'monto' => 30], ['num_elementos' => 2, 'monto' => 50], ['num_elementos' => 3, 'monto' => 70],
        ]])->assertCreated();
    }

    // ---------------------------------------------------------- Reglas de peso

    public function test_reglas_de_arranque_son_las_de_antes(): void
    {
        $this->como($this->usuario(self::RECEPCION));
        $this->getJson('/api/cargas/reglas-peso/calcular?empresa=12000&cliente=12060')->assertOk()
            ->assertJsonPath('data.kg', 12030)->assertJsonPath('data.criterio', 'PROMEDIO')->assertJsonPath('data.regla.formula', '(E+C)/2');
        $this->getJson('/api/cargas/reglas-peso/calcular?empresa=12000&cliente=11950')->assertOk()
            ->assertJsonPath('data.kg', 11950)->assertJsonPath('data.criterio', 'CLIENTE');
        $this->getJson('/api/cargas/reglas-peso/calcular?empresa=12000&cliente=12300')->assertOk()
            ->assertJsonPath('data.kg', 12000)->assertJsonPath('data.criterio', 'EMPRESA');
        $this->getJson('/api/cargas/reglas-peso/calcular?empresa=12000')->assertOk()
            ->assertJsonPath('data.kg', 12000)->assertJsonPath('data.regla', null);
    }

    public function test_publicar_reglas_con_formulas_y_porcentaje(): void
    {
        $this->como($this->usuario(self::CONFIG));
        $this->postJson('/api/cargas/reglas-peso/probar', ['formula' => 'MIN(E;C) - 0,5*ABS(D)', 'empresa' => 12000, 'cliente' => 12060])
            ->assertOk()->assertJsonPath('data.kg', 11970);
        $this->postJson('/api/cargas/reglas-peso/probar', ['formula' => 'E; DELETE FROM x', 'empresa' => 1, 'cliente' => 2])
            ->assertStatus(422)->assertJsonValidationErrors('formula');

        $reglas = [
            ['unidad' => 'KG',  'desde' => null, 'hasta' => 0,   'formula' => 'C', 'descripcion' => 'Nuestra pesa más: el del cliente'],
            ['unidad' => 'PCT', 'desde' => 0,    'hasta' => 0.5, 'formula' => 'redondear((e + c) / 2)'],
            ['unidad' => 'KG',  'desde' => null, 'hasta' => null, 'formula' => 'E - 10'],
        ];
        // Fórmula que no calcula: no se publica nada.
        $this->postJson('/api/cargas/reglas-peso', ['vigente_desde' => now()->toDateString(),
            'reglas' => [...$reglas, ['unidad' => 'KG', 'formula' => '(E+']]])->assertStatus(422);
        $this->postJson('/api/cargas/reglas-peso', ['vigente_desde' => now()->toDateString(), 'reglas' => $reglas])->assertCreated();

        $this->getJson('/api/cargas/reglas-peso')->assertOk()->assertJsonPath('data.0.estado', 'VIGENTE')
            ->assertJsonPath('data.0.reglas.1.formula', 'REDONDEAR((E + C) / 2)');
        // 12000 vs 12050: 0,42 % → promedio redondeado; 12000 vs 12100: 0,83 % → la regla general.
        $this->getJson('/api/cargas/reglas-peso/calcular?empresa=12000&cliente=12051')->assertJsonPath('data.kg', 12026)
            ->assertJsonPath('data.criterio', 'FORMULA');
        $this->getJson('/api/cargas/reglas-peso/calcular?empresa=12000&cliente=12100')->assertJsonPath('data.kg', 11990)
            ->assertJsonPath('data.regla.orden', 3);

        // El pesaje guarda con qué regla salió.
        $this->como($this->usuario(self::RECEPCION));
        $p = $this->recibir([], $this->pesaje(['peso_bruto_kg' => 20000, 'tara_kg' => 8000,
            'peso_cliente_bruto_kg' => 20100, 'peso_cliente_tara_kg' => 8000]))->assertCreated()->json('data.pesajes.0');
        $this->assertSame('12100.00', $p['peso_cliente_kg']);
        $this->assertSame('20100.00', $p['peso_cliente_bruto_kg']);
        $this->assertSame('11990.00', $p['peso_final_kg']);
        $this->assertSame('E - 10', $p['regla_peso']['formula']);
    }

    public function test_peso_del_cliente_con_bruto_y_tara(): void
    {
        $this->como($this->usuario(self::RECEPCION));
        $p = $this->recibir([], $this->pesaje(['peso_bruto_kg' => 20000, 'tara_kg' => 8000,
            'peso_cliente_bruto_kg' => 20050, 'peso_cliente_tara_kg' => 7990]))->assertCreated()->json('data.pesajes.0');
        $this->assertSame('12060.00', $p['peso_cliente_kg']);
        $this->assertSame('NETO', $p['peso_cliente_tipo']);
        $this->assertSame('12030.00', $p['peso_final_kg']);

        $this->recibir([], $this->pesaje(['peso_cliente_bruto_kg' => 9000, 'peso_cliente_tara_kg' => 9500]))
            ->assertStatus(422)->assertJsonValidationErrors('pesaje.peso_cliente_tara_kg');
    }

    // ---------------------------------------------------------- Bono de laboratorio

    public function test_bono_de_laboratorio_por_elementos_y_su_pago_a_quien_cobra(): void
    {
        $this->tablaLaboratorio();
        $this->como($this->usuario(self::RECEPCION));
        $this->getJson('/api/cargas/bono-laboratorio-tramos/calcular?material=ZN-AG-PB')->assertJsonPath('data.monto', '70.00');

        $r = $this->recibir(['material' => 'ZN-AG'])->assertCreated();
        $this->assertStringContainsString('Bono de laboratorio: Bs 50,00', $r->json('mensaje'));
        $lote = $r->json('data');
        $this->assertSame('50.00', $lote['bono_laboratorio']['monto']);
        $this->assertSame(2, $lote['bono_laboratorio']['num_elementos']);
        $sinMaterial = $this->recibir([], $this->pesaje(['ticket' => 't-101']))->assertCreated()->json('data');
        $this->assertNull($sinMaterial['bono_laboratorio']);

        [$caja] = $this->cajaAbierta(1000);
        $pend = $this->getJson("/api/cargas/bonos-laboratorio/pendientes?caja_id={$caja->id}")->assertOk()->assertJsonCount(1, 'data')->json('data.0');
        $this->assertSame('JUAN MAMANI', $pend['lote']['productor']['nombre']);

        $this->postJson("/api/cargas/bonos-laboratorio/{$pend['id']}/pagar", ['caja_id' => $caja->id])
            ->assertStatus(422)->assertJsonValidationErrors('beneficiario_nombre');
        $mov = $this->postJson("/api/cargas/bonos-laboratorio/{$pend['id']}/pagar",
            ['caja_id' => $caja->id, 'beneficiario_nombre' => 'rosa  condori', 'beneficiario_ci' => '556 677'])->assertCreated()
            ->assertJsonPath('data.concepto.codigo', 'BONO_LABORATORIO')
            ->assertJsonPath('data.persona_nombre', 'ROSA CONDORI')
            ->assertJsonPath('data.monto', '50.00')->json('data');
        $this->assertStringContainsString('por cuenta de JUAN MAMANI', $mov['glosa']);
        $b = DB::table('cargas.bono_laboratorio')->find($pend['id']);
        $this->assertSame(['PAGADO', 'ROSA CONDORI', '556677'], [$b->estado, $b->beneficiario_nombre, $b->beneficiario_ci]);

        // Desde caja no se anula.
        $this->postJson("/api/caja/movimientos/{$mov['id']}/anular", ['motivo' => 'Pagado por error a otra persona'])->assertForbidden();

        // Los dos bonos pagados son lo adelantado del lote.
        $this->postJson("/api/cargas/bonos/{$lote['pesajes'][0]['bono']['id']}/pagar", ['caja_id' => $caja->id])->assertCreated();
        $a = DB::table('cargas.v_lote_anticipos')->where('lote_id', $lote['id'])->first();
        $this->assertSame([80.0, 50.0, 130.0, 0], [(float) $a->bono_transporte_bob, (float) $a->bono_laboratorio_bob, (float) $a->total_bob, (int) $a->bonos_pendientes]);
    }

    public function test_anular_el_lote_anula_su_bono_de_laboratorio_pendiente(): void
    {
        $this->tablaLaboratorio();
        $this->como($this->usuario([...self::RECEPCION, 'cargas.anular-lote']));
        $lote = $this->recibir(['material' => 'ZN'])->json('data');
        $this->assertSame('30.00', $lote['bono_laboratorio']['monto']);
        $this->postJson("/api/cargas/lotes/{$lote['id']}/anular", ['motivo' => 'Carga rechazada por humedad'])->assertOk();
        $this->assertSame('ANULADO', DB::table('cargas.bono_laboratorio')->where('lote_id', $lote['id'])->value('estado'));
    }

    public function test_la_tabla_de_laboratorio_no_repite_cantidades_ni_rige_hacia_atras(): void
    {
        $this->como($this->usuario(self::CONFIG));
        $this->postJson('/api/cargas/bono-laboratorio-tramos', ['vigente_desde' => now()->toDateString(), 'tramos' => [
            ['num_elementos' => 1, 'monto' => 30], ['num_elementos' => 1, 'monto' => 40]]])->assertStatus(422)->assertJsonValidationErrors('tramos');
        $this->postJson('/api/cargas/bono-laboratorio-tramos', ['vigente_desde' => now()->subDay()->toDateString(), 'tramos' => [
            ['num_elementos' => 1, 'monto' => 30]]])->assertStatus(422)->assertJsonValidationErrors('vigente_desde');
        $this->como($this->usuario(self::RECEPCION));
        $this->postJson('/api/cargas/bono-laboratorio-tramos', ['vigente_desde' => now()->toDateString(), 'tramos' => [
            ['num_elementos' => 1, 'monto' => 30]]])->assertForbidden();
    }

    // ---------------------------------------------------------- Clasificación

    public function test_resumen_y_filtros_de_cargas_por_clasificacion(): void
    {
        $this->como($this->usuario([...self::RECEPCION, 'cargas.anular-lote']));
        $a = $this->recibir(['material' => 'ZN-AG'], $this->pesaje(['ticket' => 'R-1', 'peso_bruto_kg' => 20000, 'tara_kg' => 8000]))->json('data');
        $this->recibir(['material' => 'ZN'], $this->pesaje(['ticket' => 'R-2', 'peso_bruto_kg' => 10000, 'tara_kg' => 4000]))->assertCreated();
        $anulado = $this->recibir([], $this->pesaje(['ticket' => 'R-3']))->json('data');
        $this->postJson("/api/cargas/lotes/{$anulado['id']}/anular", ['motivo' => 'Carga rechazada en el acopio'])->assertOk();

        $hoy = now()->toDateString();
        $r = $this->getJson("/api/cargas/reportes/resumen?desde={$hoy}&hasta={$hoy}")->assertOk()->json('data');
        $this->assertSame(2, $r['totales']['lotes']);                       // el anulado no cuenta
        $this->assertEqualsWithDelta(18000, $r['totales']['kg'], 0.01);
        $this->assertSame(['ZN-AG', 'ZN'], array_column($r['por_material'], 'clave'));
        $this->assertSame('CZP', $r['por_tipo'][0]['clave']);
        $this->assertSame(1, count($r['por_dia']));

        $this->getJson("/api/cargas/reportes/resumen?desde={$hoy}&hasta={$hoy}&material=ZN")->assertJsonPath('data.totales.lotes', 1);
        $this->getJson("/api/cargas/lotes?material=ZN-AG")->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.id', $a['id']);
        $this->getJson("/api/cargas/lotes?origen=PROPIA")->assertOk()->assertJsonPath('total', 0);

        $this->get("/api/cargas/reportes/resumen/pdf?desde={$hoy}&hasta={$hoy}")->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->get("/api/cargas/reportes/resumen/excel?desde={$hoy}&hasta={$hoy}")->assertOk();
        $this->getJson("/api/cargas/reportes/resumen?desde={$hoy}&hasta=2020-01-01")->assertStatus(422);
    }
}
