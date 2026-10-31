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

        $k = DB::table('cargas.tipo_bono')->where('codigo', 'TRANSPORTE')->value('id');
        DB::table('cargas.tipo_bono_tramo')->insert([
            ['tipo_bono_id' => $k, 'etiqueta' => 'TONKA',    'desde' => 500,  'hasta' => 7000,  'monto' => 50,  'vigente_desde' => '2026-01-01'],
            ['tipo_bono_id' => $k, 'etiqueta' => 'SENCILLO', 'desde' => 7000, 'hasta' => 10000, 'monto' => 80,  'vigente_desde' => '2026-01-01'],
            ['tipo_bono_id' => $k, 'etiqueta' => 'DOBLE',    'desde' => 10000, 'hasta' => null, 'monto' => 100, 'vigente_desde' => '2026-01-01'],
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
        $this->postJson("/api/cargas/tipos-bono/{$this->lab()}/tramos", ['vigente_desde' => now()->toDateString(), 'tramos' => [
            ['desde' => 1, 'monto' => 30], ['desde' => 2, 'monto' => 50], ['desde' => 3, 'monto' => 70],
        ]])->assertCreated();
    }

    private function lab(): int
    {
        return (int) DB::table('cargas.tipo_bono')->where('codigo', 'LABORATORIO')->value('id');
    }

    /** El bono del lote de ese tipo (de la ficha). */
    private static function bonoDe(array $lote, string $codigo): ?array
    {
        return collect($lote['bonos'])->first(fn ($b) => $b['tipo']['codigo'] === $codigo && $b['estado'] !== 'ANULADO');
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
        $this->getJson('/api/cargas/tipos-bono/calcular?material=ZN-AG-PB')->assertJsonPath('data.0.codigo', 'LABORATORIO')
            ->assertJsonPath('data.0.monto', '70.00')->assertJsonPath('data.0.detalle', '3 elementos');

        $r = $this->recibir(['material' => 'ZN-AG'])->assertCreated();
        $this->assertStringContainsString('bono de laboratorio Bs 50,00', $r->json('mensaje'));
        $this->assertStringContainsString('bono de transporte Bs 80,00', $r->json('mensaje'));
        $lote = $r->json('data');
        $lab = self::bonoDe($lote, 'LABORATORIO');
        $this->assertSame(['50.00', '2.00', 'JUAN MAMANI', 'ANTICIPO'], [$lab['monto'], $lab['base'], $lab['beneficiario_nombre'], $lab['naturaleza']]);
        $sinMaterial = $this->recibir([], $this->pesaje(['ticket' => 't-101']))->assertCreated()->json('data');
        $this->assertNull(self::bonoDe($sinMaterial, 'LABORATORIO'));

        [$caja] = $this->cajaAbierta(1000);
        $pend = collect($this->getJson("/api/cargas/bonos/pendientes?caja_id={$caja->id}")->assertOk()->assertJsonCount(3, 'data')->json('data'))
            ->firstWhere('id', $lab['id']);
        $this->assertSame('JUAN MAMANI', $pend['lote']['productor']['nombre']);
        $this->assertTrue($pend['tipo']['permite_otro']);

        $mov = $this->postJson("/api/cargas/bonos/{$lab['id']}/pagar",
            ['caja_id' => $caja->id, 'beneficiario_nombre' => 'rosa  condori', 'beneficiario_ci' => '556 677'])->assertCreated()
            ->assertJsonPath('data.concepto.codigo', 'BONO_LABORATORIO')
            ->assertJsonPath('data.persona_nombre', 'ROSA CONDORI')
            ->assertJsonPath('data.monto', '50.00')->json('data');
        $this->assertStringContainsString('por cuenta de JUAN MAMANI', $mov['glosa']);
        $b = DB::table('cargas.bono')->find($lab['id']);
        $this->assertSame(['PAGADO', 'ROSA CONDORI', '556677'], [$b->estado, $b->beneficiario_nombre, $b->beneficiario_ci]);

        // Desde caja no se anula.
        $this->postJson("/api/caja/movimientos/{$mov['id']}/anular", ['motivo' => 'Pagado por error a otra persona'])->assertForbidden();

        // Los dos bonos pagados son lo adelantado del lote.
        $this->postJson('/api/cargas/bonos/' . self::bonoDe($lote, 'TRANSPORTE')['id'] . '/pagar', ['caja_id' => $caja->id])->assertCreated();
        $a = DB::table('cargas.v_lote_anticipos')->where('lote_id', $lote['id'])->first();
        $this->assertSame([130.0, 0.0, 130.0, 0], [(float) $a->bonos_bob, (float) $a->premios_bob, (float) $a->total_bob, (int) $a->bonos_pendientes]);
    }

    public function test_anular_el_lote_anula_su_bono_de_laboratorio_pendiente(): void
    {
        $this->tablaLaboratorio();
        $this->como($this->usuario([...self::RECEPCION, 'cargas.anular-lote']));
        $lote = $this->recibir(['material' => 'ZN'])->json('data');
        $this->assertSame('30.00', self::bonoDe($lote, 'LABORATORIO')['monto']);
        $this->postJson("/api/cargas/lotes/{$lote['id']}/anular", ['motivo' => 'Carga rechazada por humedad'])->assertOk();
        $this->assertSame(['ANULADO'], DB::table('cargas.bono')->where('lote_id', $lote['id'])->distinct()->pluck('estado')->all());
    }

    public function test_la_tabla_de_laboratorio_no_repite_cantidades_ni_rige_hacia_atras(): void
    {
        $this->como($this->usuario(self::CONFIG));
        $this->postJson("/api/cargas/tipos-bono/{$this->lab()}/tramos", ['vigente_desde' => now()->toDateString(), 'tramos' => [
            ['desde' => 1, 'monto' => 30], ['desde' => 1, 'monto' => 40]]])->assertStatus(422)->assertJsonValidationErrors('tramos');
        $this->postJson("/api/cargas/tipos-bono/{$this->lab()}/tramos", ['vigente_desde' => now()->subDay()->toDateString(), 'tramos' => [
            ['desde' => 1, 'monto' => 30]]])->assertStatus(422)->assertJsonValidationErrors('vigente_desde');
        $this->como($this->usuario(self::RECEPCION));
        $this->postJson("/api/cargas/tipos-bono/{$this->lab()}/tramos", ['vigente_desde' => now()->toDateString(), 'tramos' => [
            ['desde' => 1, 'monto' => 30]]])->assertForbidden();
    }

    // ---------------------------------------------------------- Catálogo de bonos

    public function test_catalogo_bono_fijo_premio_y_por_tonelada(): void
    {
        $this->como($this->usuario(self::RECEPCION));
        $this->postJson('/api/cargas/tipos-bono', ['codigo' => 'X'])->assertForbidden();

        $this->como($this->usuario(self::CONFIG));
        $carguio = $this->postJson('/api/cargas/tipos-bono', [
            'codigo' => 'carguio', 'nombre' => 'Bono de carguío', 'calculo' => 'POR_TONELADA', 'naturaleza' => 'ANTICIPO',
            'cobra' => 'CHOFER', 'permite_otro' => false, 'aplica_a' => 'TODOS',
        ])->assertCreated()->assertJsonPath('data.codigo', 'CARGUIO')->json('data');
        $this->assertSame('BONO_CARGUIO', DB::table('caja.concepto')->where('id', $carguio['concepto_id'])->value('codigo'));
        $premio = $this->postJson('/api/cargas/tipos-bono', [
            'codigo' => 'FIDELIDAD', 'nombre' => 'Premio de fidelidad', 'calculo' => 'FIJO', 'naturaleza' => 'PREMIO',
            'cobra' => 'PRODUCTOR', 'permite_otro' => true, 'aplica_a' => 'COMPRA', 'serie_id' => $this->serie('CZP'),
        ])->assertCreated()->json('data');
        $this->postJson("/api/cargas/tipos-bono/{$premio['id']}/tramos", ['vigente_desde' => now()->toDateString(),
            'tramos' => [['monto' => 20], ['monto' => 30]]])->assertStatus(422)->assertJsonValidationErrors('tramos');
        $this->postJson("/api/cargas/tipos-bono/{$premio['id']}/tramos", ['vigente_desde' => now()->toDateString(),
            'tramos' => [['monto' => 25]]])->assertCreated();
        $this->postJson("/api/cargas/tipos-bono/{$carguio['id']}/tramos", ['vigente_desde' => now()->toDateString(),
            'tramos' => [['monto' => 4.5]]])->assertCreated();

        // Transporte no cambia de cálculo; el bono con tabla, tampoco.
        $transporte = DB::table('cargas.tipo_bono')->where('codigo', 'TRANSPORTE')->first();
        $this->putJson("/api/cargas/tipos-bono/{$transporte->id}", ['codigo' => 'TRANSPORTE', 'nombre' => 'Bono de transporte',
            'calculo' => 'FIJO', 'naturaleza' => 'ANTICIPO', 'cobra' => 'CHOFER', 'permite_otro' => true, 'aplica_a' => 'TODOS'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'no se cambia'));

        $this->como($this->usuario(self::RECEPCION));
        $this->getJson('/api/cargas/tipos-bono/calcular?peso_kg=8200&serie_id=' . $this->serie('CZP'))->assertOk()
            ->assertJsonCount(3, 'data')->assertJsonPath('data.2.codigo', 'FIDELIDAD');
        $lote = $this->recibir()->assertCreated()->json('data');
        $fid = self::bonoDe($lote, 'FIDELIDAD');
        $car = self::bonoDe($lote, 'CARGUIO');
        $this->assertSame(['25.00', 'PREMIO', 'JUAN MAMANI'], [$fid['monto'], $fid['naturaleza'], $fid['beneficiario_nombre']]);
        $this->assertSame(['36.90', '8200.00', 'PEDRO QUISPE'], [$car['monto'], $car['base'], $car['beneficiario_nombre']]);   // 4,50 × 8,2 t

        // Producción propia: el premio de compra no aplica.
        $bm = $this->recibir(['serie_id' => $this->serie('BM'), 'productor_id' => null, 'mina_id' => $this->minaPropia->id,
            'bocamina_id' => $this->bocamina->id], $this->pesaje(['ticket' => 't-200']))->assertCreated()->json('data');
        $this->assertNull(self::bonoDe($bm, 'FIDELIDAD'));
        $this->assertNotNull(self::bonoDe($bm, 'CARGUIO'));

        [$caja] = $this->cajaAbierta(1000);
        $this->postJson("/api/cargas/bonos/{$car['id']}/pagar", ['caja_id' => $caja->id, 'beneficiario_nombre' => 'Otro Señor'])
            ->assertStatus(422)->assertJsonValidationErrors('beneficiario_nombre');
        $this->postJson("/api/cargas/bonos/{$car['id']}/pagar", ['caja_id' => $caja->id])->assertCreated()
            ->assertJsonPath('data.concepto.codigo', 'BONO_CARGUIO')->assertJsonPath('data.persona_nombre', 'PEDRO QUISPE');
        $this->postJson("/api/cargas/bonos/{$fid['id']}/pagar", ['caja_id' => $caja->id])->assertCreated();

        $a = DB::table('cargas.v_lote_anticipos')->where('lote_id', $lote['id'])->first();
        $this->assertSame([36.9, 25.0, 36.9, 1], [(float) $a->bonos_bob, (float) $a->premios_bob, (float) $a->total_bob, (int) $a->bonos_pendientes]);
    }

    public function test_bono_manual_se_agrega_en_la_ficha_y_se_anula_si_esta_pendiente(): void
    {
        $this->como($this->usuario(self::CONFIG));
        $manual = $this->postJson('/api/cargas/tipos-bono', [
            'codigo' => 'ESTIBAJE', 'nombre' => 'Bono de estibaje', 'calculo' => 'MANUAL', 'naturaleza' => 'ANTICIPO',
            'cobra' => 'PRODUCTOR', 'permite_otro' => true, 'aplica_a' => 'TODOS',
        ])->assertCreated()->json('data');
        $this->postJson("/api/cargas/tipos-bono/{$manual['id']}/tramos", ['vigente_desde' => now()->toDateString(),
            'tramos' => [['monto' => 10]]])->assertStatus(422);

        $this->como($this->usuario(self::RECEPCION));
        $lote = $this->recibir()->json('data');
        $this->assertNull(self::bonoDe($lote, 'ESTIBAJE'));
        $transporte = DB::table('cargas.tipo_bono')->where('codigo', 'TRANSPORTE')->value('id');
        $this->postJson("/api/cargas/lotes/{$lote['id']}/bonos", ['tipo_bono_id' => $transporte, 'monto' => 10])
            ->assertStatus(422)->assertJsonValidationErrors('tipo_bono_id');
        $b = $this->postJson("/api/cargas/lotes/{$lote['id']}/bonos", ['tipo_bono_id' => $manual['id'], 'monto' => 45.5,
            'observacion' => 'Descarga de 160 sacos'])->assertCreated()
            ->assertJsonPath('data.monto', '45.50')->assertJsonPath('data.beneficiario_nombre', 'JUAN MAMANI')->json('data');
        $this->postJson("/api/cargas/lotes/{$lote['id']}/bonos", ['tipo_bono_id' => $manual['id'], 'monto' => 5])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'ya tiene ese bono'));

        $this->postJson("/api/cargas/bonos/{$b['id']}/anular", ['motivo' => 'Se cargó dos veces'])->assertForbidden();
        $this->como($this->usuario([...self::RECEPCION, 'cargas.anular-lote']));
        $this->postJson("/api/cargas/bonos/{$b['id']}/anular", ['motivo' => 'x'])->assertStatus(422);
        $this->postJson("/api/cargas/bonos/{$b['id']}/anular", ['motivo' => 'Se cargó dos veces'])->assertOk()
            ->assertJsonPath('data.estado', 'ANULADO');
        $this->postJson("/api/cargas/bonos/{$b['id']}/anular", ['motivo' => 'Otra vez'])->assertStatus(422);
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
