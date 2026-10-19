<?php

namespace Tests\Feature\Cargas;

use App\Models\User;
use App\Modules\Cargas\Models\Cooperativa;
use App\Modules\Cargas\Models\Elemento;
use App\Modules\Cargas\Models\LineaProducto;
use App\Modules\Cargas\Models\Municipio;
use App\Modules\Cargas\Models\Productor;
use App\Modules\Cargas\Models\RetencionConcepto;
use App\Modules\Cargas\Models\SerieLote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Sprint 6 — tablas de precio, cotizaciones, retenciones y valor estimado del lote. */
class PreciosApiTest extends TestCase
{
    use PreparaBaseCargas;
    use RefreshDatabase;

    private const EDITOR    = ['cargas.ver', 'cargas.precios-editar'];
    private const APROBADOR = ['cargas.ver', 'cargas.precios-aprobar'];

    private int $czp;
    private int $ag;
    private int $zn;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
        $this->czp = LineaProducto::where('codigo', 'COMPLEJO_ZN_AG')->value('id');
        $this->ag = Elemento::where('codigo', 'AG')->value('id');
        $this->zn = Elemento::where('codigo', 'ZN')->value('id');
    }

    private function como(array $permisos): User
    {
        $u = User::factory()->create();
        $u->givePermissionTo($permisos);
        $u->almacenes()->sync([1]);
        Sanctum::actingAs($u->fresh());

        return $u;
    }

    private function tabla(array $cambios = [], ?array $tramos = null): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/cargas/precios', [
            'linea_producto_id' => $this->czp, 'elemento_id' => $this->ag, 'moneda' => 'BOB', 'vigente_desde' => '2026-01-01',
            'tramos' => $tramos ?? [
                ['ley_desde' => 3, 'ley_hasta' => 5, 'precio_punto' => 21], ['ley_desde' => 5, 'ley_hasta' => 8, 'precio_punto' => 24],
                ['ley_desde' => 8, 'ley_hasta' => 13, 'precio_punto' => 27], ['ley_desde' => 13, 'ley_hasta' => null, 'precio_punto' => 30],
            ],
            ...$cambios,
        ]);
    }

    public function test_borrador_aprobado_por_otra_persona_y_reglas_de_la_tabla(): void
    {
        $this->como(['cargas.ver']);
        $this->tabla()->assertForbidden();

        $editor = $this->como(self::EDITOR);
        $id = $this->tabla()->assertCreated()->assertJsonPath('data.modalidad', 'POR_PUNTO')->json('data.id');

        // Vista previa: valor por TM al inicio y fin de cada tramo.
        $p = $this->getJson("/api/cargas/precios/{$id}")->assertOk();
        $this->assertEquals(120.0, $p->json('data.vista_previa.tramos.1.valor_desde'));   // 5 × 24
        $this->assertEquals(192.0, $p->json('data.vista_previa.tramos.1.valor_hasta'));   // 8 × 24
        $this->assertSame('BORRADOR', $p->json('data.situacion'));

        // El editor no aprueba; tampoco quien la armó aunque tenga el permiso.
        $this->postJson("/api/cargas/precios/{$id}/aprobar")->assertForbidden();
        $editor->givePermissionTo('cargas.precios-aprobar');
        Sanctum::actingAs($editor->fresh());
        $this->postJson("/api/cargas/precios/{$id}/aprobar")->assertUnprocessable()
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'la aprueba otra persona'));

        $this->como(self::APROBADOR);
        $this->postJson("/api/cargas/precios/{$id}/aprobar")->assertOk()->assertJsonPath('data.estado', 'APROBADA');
        $this->getJson('/api/cargas/precios')->assertOk()->assertJsonPath('data.0.situacion', 'VIGENTE');

        // Aprobada no se edita.
        $this->como(self::EDITOR);
        $this->putJson("/api/cargas/precios/{$id}", ['linea_producto_id' => $this->czp, 'elemento_id' => $this->ag, 'moneda' => 'BOB',
            'vigente_desde' => '2026-01-01', 'tramos' => [['ley_desde' => 3, 'precio_punto' => 99]]])->assertUnprocessable();
    }

    public function test_tabla_con_tramo_que_baja_o_con_hueco_no_se_aprueba(): void
    {
        $this->como(self::EDITOR);
        $baja = $this->tabla(['elemento_id' => $this->zn], [
            ['ley_desde' => 13, 'ley_hasta' => 15, 'precio_punto' => 30.86], ['ley_desde' => 15, 'ley_hasta' => 16, 'precio_punto' => 31.03],
            ['ley_desde' => 16, 'precio_punto' => 30.64],
        ])->assertCreated()->json('data.id');
        $hueco = $this->tabla(['elemento_id' => $this->zn, 'vigente_desde' => '2027-01-01'], [
            ['ley_desde' => 3, 'ley_hasta' => 5, 'precio_punto' => 21], ['ley_desde' => 6, 'precio_punto' => 24],
        ])->assertCreated()->json('data.id');

        $prev = $this->getJson("/api/cargas/precios/{$baja}")->json('data.vista_previa.tramos');
        $this->assertTrue($prev[2]['baja']);

        $this->como(self::APROBADOR);
        $this->postJson("/api/cargas/precios/{$baja}/aprobar")->assertUnprocessable()
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'una ley mayor no puede valer menos'));
        $this->postJson("/api/cargas/precios/{$hueco}/aprobar")->assertUnprocessable()
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'hueco'));

        // Concentrados y elementos no pagables no llevan tabla.
        $this->como(self::EDITOR);
        $this->tabla(['linea_producto_id' => LineaProducto::where('codigo', 'CONC_ZN')->value('id'), 'elemento_id' => $this->zn])
            ->assertUnprocessable()->assertJsonValidationErrors('linea_producto_id');
        $this->tabla(['elemento_id' => Elemento::where('codigo', 'PB')->value('id')])
            ->assertUnprocessable()->assertJsonValidationErrors('elemento_id');
    }

    public function test_reemplazar_la_tabla_vigente_sin_tocar_dias_pasados(): void
    {
        $this->como(self::EDITOR);
        $vieja = $this->tabla()->json('data.id');
        $this->como(self::APROBADOR);
        $this->postJson("/api/cargas/precios/{$vieja}/aprobar")->assertOk();

        $this->como(self::EDITOR);
        $nueva = $this->postJson("/api/cargas/precios/{$vieja}/copiar")->assertCreated()->json('data');
        $this->assertSame(now()->addDay()->toDateString(), $nueva['vigente_desde']);

        // Con fecha pasada, la nueva reemplazaría precios de días ya transcurridos.
        $this->putJson("/api/cargas/precios/{$nueva['id']}", ['linea_producto_id' => $this->czp, 'elemento_id' => $this->ag, 'moneda' => 'BOB',
            'vigente_desde' => now()->subDays(3)->toDateString(),
            'tramos' => [['ley_desde' => 3, 'ley_hasta' => 10, 'precio_punto' => 25], ['ley_desde' => 10, 'precio_punto' => 31]]])->assertOk();
        $this->como(self::APROBADOR);
        $this->postJson("/api/cargas/precios/{$nueva['id']}/aprobar")->assertUnprocessable()
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'días pasados'));

        $this->como(self::EDITOR);
        $this->putJson("/api/cargas/precios/{$nueva['id']}", ['linea_producto_id' => $this->czp, 'elemento_id' => $this->ag, 'moneda' => 'BOB',
            'vigente_desde' => now()->addDays(2)->toDateString(),
            'tramos' => [['ley_desde' => 3, 'ley_hasta' => 10, 'precio_punto' => 25], ['ley_desde' => 10, 'precio_punto' => 31]]])->assertOk();
        $this->como(self::APROBADOR);
        $this->postJson("/api/cargas/precios/{$nueva['id']}/aprobar")->assertOk();

        $this->assertSame(now()->addDays(2)->toDateString(), DB::table('cargas.tabla_precio')->where('id', $vieja)->value('vigente_hasta'));
        $situaciones = collect($this->getJson('/api/cargas/precios')->json('data'))->pluck('situacion', 'id');
        $this->assertSame('VIGENTE', $situaciones[$vieja]);
        $this->assertSame('PROXIMA', $situaciones[$nueva['id']]);

        // La próxima se puede anular (todavía no rige); la vigente no.
        $this->postJson("/api/cargas/precios/{$vieja}/anular")->assertUnprocessable();
        $this->postJson("/api/cargas/precios/{$nueva['id']}/anular")->assertOk();
    }

    public function test_cotizaciones_y_retenciones(): void
    {
        $this->como(['cargas.ver', 'cargas.cotizaciones']);
        $datos = ['elemento_id' => $this->ag, 'tipo' => 'OFICIAL', 'anio' => 2026, 'mes' => 10, 'quincena' => 2, 'valor' => 31.25,
                  'unidad' => 'OT', 'alicuota_rm_exportacion' => 6, 'alicuota_rm_venta_interna' => 3.6];
        $id = $this->postJson('/api/cargas/cotizaciones', $datos)->assertCreated()->assertJsonPath('data.periodo_hasta', '2026-10-31')->json('data.id');
        $this->postJson('/api/cargas/cotizaciones', $datos)->assertUnprocessable()->assertJsonValidationErrors('quincena');
        $this->putJson("/api/cargas/cotizaciones/{$id}", [...$datos, 'valor' => 31.52])->assertOk()->assertJsonPath('data.valor', '31.5200');
        $this->assertSame(1, DB::table('cargas.cotizacion_cambio')->where('cotizacion_id', $id)->count());

        $this->como(['cargas.ver', 'cargas.retenciones']);
        $cns = RetencionConcepto::where('codigo', 'CNS')->value('id');
        $coop = RetencionConcepto::where('codigo', 'APORTE_COOPERATIVA')->value('id');
        $this->postJson('/api/cargas/retenciones/tasas', ['concepto_id' => $cns, 'porcentaje' => 2, 'vigente_desde' => now()->subDay()->toDateString()])
            ->assertUnprocessable()->assertJsonPath('message', fn ($m) => str_contains($m, 'días pasados'));
        $this->postJson('/api/cargas/retenciones/tasas', ['concepto_id' => $cns, 'porcentaje' => 2, 'vigente_desde' => now()->addDay()->toDateString()])
            ->assertCreated();
        $this->postJson('/api/cargas/retenciones/tasas', ['concepto_id' => $coop, 'porcentaje' => 3, 'vigente_desde' => '2026-01-01'])
            ->assertUnprocessable()->assertJsonValidationErrors('cooperativa_id');

        $mun = Municipio::create(['codigo' => '050601', 'nombre' => 'PORCO', 'departamento' => 'POTOSI']);
        $c = Cooperativa::create(['nombre' => 'COOPERATIVA PORCO LTDA.', 'municipio_id' => $mun->id]);
        $this->postJson('/api/cargas/retenciones/tasas', ['concepto_id' => $coop, 'cooperativa_id' => $c->id, 'porcentaje' => 3, 'vigente_desde' => '2026-01-01'])
            ->assertCreated();

        $r = collect($this->getJson('/api/cargas/retenciones')->assertOk()->json('data'))->keyBy('codigo');
        $this->assertCount(2, $r['CNS']['tasas']);
        $this->assertTrue($r['CNS']['tasas'][0]['proxima']);
        $this->assertTrue($r['CNS']['tasas'][1]['vigente']);
        $this->assertEquals(1.8, (float) DB::selectOne("select cargas.retencion_vigente('CNS', null, current_date) as t")->t);
        $this->assertEquals(3, (float) DB::selectOne("select cargas.retencion_vigente('APORTE_COOPERATIVA', ?, current_date) as t", [$c->id])->t);
    }

    public function test_valor_estimado_del_lote(): void
    {
        // Tablas aprobadas para Ag y Zn.
        $this->como(self::EDITOR);
        $tAg = $this->tabla()->json('data.id');
        $tZn = $this->tabla(['elemento_id' => $this->zn], [['ley_desde' => 5, 'ley_hasta' => 15, 'precio_punto' => 8], ['ley_desde' => 15, 'precio_punto' => 10]])->json('data.id');
        $this->como(self::APROBADOR);
        $this->postJson("/api/cargas/precios/{$tAg}/aprobar")->assertOk();
        $this->postJson("/api/cargas/precios/{$tZn}/aprobar")->assertOk();

        // Lote de 8.200 kg con lectura estimada.
        $this->como(['cargas.ver', 'cargas.recibir']);
        $mun = Municipio::create(['codigo' => '050601', 'nombre' => 'PORCO', 'departamento' => 'POTOSI']);
        $p = Productor::create(['tipo' => 'PARTICULAR', 'nombre' => 'JUAN MAMANI', 'ci' => '4455667']);
        $lote = $this->postJson('/api/cargas/lotes', ['serie_id' => SerieLote::where('prefijo', 'CZP')->value('id'), 'almacen_id' => 1,
            'productor_id' => $p->id, 'pesaje' => ['bascula' => 'P1', 'ticket' => 'T-1', 'peso_bruto_kg' => 12500, 'tara_kg' => 4300, 'chofer_nombre' => 'PEDRO']])
            ->assertCreated()->json('data.id');

        $v = $this->getJson("/api/cargas/lotes/{$lote}/valor")->assertOk()->json('data');
        $this->assertNull($v['elementos'][0]['valor']);
        $this->assertStringStartsWith('Sin ley', $v['elementos'][0]['observacion']);

        $this->putJson("/api/cargas/lotes/{$lote}/lectura-estimada", ['lecturas' => [
            ['elemento_id' => $this->ag, 'valor' => 10], ['elemento_id' => $this->zn, 'valor' => 18]]])->assertOk();
        $v = collect($this->getJson("/api/cargas/lotes/{$lote}/valor")->json('data.elementos'))->keyBy('elemento');
        $this->assertSame('LECTURA_ESTIMADA', $v['AG']['fuente']);
        $this->assertEquals(270, (float) $v['AG']['valor_por_tm']);          // 10 × 27
        $this->assertEquals(2214, (float) $v['AG']['valor']);                 // 270 × 8,2 t (sin humedad)
        $this->assertEquals(1476, (float) $v['ZN']['valor']);                 // 18 × 10 × 8,2
        $this->assertStringStartsWith('Sin humedad', $v['AG']['observacion']);

        $this->putJson("/api/cargas/lotes/{$lote}/lectura-estimada", ['lecturas' => [
            ['elemento_id' => Elemento::where('codigo', 'H2O')->value('id'), 'valor' => 5]]])->assertOk();
        $d = $this->getJson("/api/cargas/lotes/{$lote}/valor")->json('data');
        $this->assertEquals(7.79, (float) $d['elementos'][0]['peso_seco_tm']);   // 8,2 × 0,95
        $this->assertEquals(round(270 * 7.79 + 180 * 7.79, 2), $d['totales']['BOB']);
        $this->assertTrue($d['completo']);
        $this->assertFalse($d['definitivo']);
    }
}
