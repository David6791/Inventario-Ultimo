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
 * Sprint 4 — Recepción: lote, pesajes, bono de transporte y su pago por caja.
 */
class RecepcionApiTest extends TestCase
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

    // ---------------------------------------------------------- Recepción

    public function test_recibir_un_lote_de_compra_con_su_pesaje_y_bono(): void
    {
        $this->como($this->usuario(self::RECEPCION));

        $r = $this->recibir()->assertCreated()
            ->assertJsonPath('data.codigo', 'CZP-' . now()->format('Ym') . '-0001')
            ->assertJsonPath('data.cooperativa_id', $this->cooperativa->id)
            ->assertJsonPath('data.municipio_id', $this->municipio->id)
            ->assertJsonPath('data.guia_transporte', 'G-123')
            ->assertJsonPath('data.peso_neto_humedo_kg', '8200.00')
            ->assertJsonPath('data.pesajes.0.placa', '1234ABC')
            ->assertJsonPath('data.pesajes.0.chofer_nombre', 'PEDRO QUISPE')
            ->assertJsonPath('data.pesajes.0.bono.monto', '80.00')
            ->assertJsonPath('data.pesajes.0.bono.estado', 'PENDIENTE')
            ->assertJsonPath('mensaje', fn ($m) => str_contains($m, 'por pagar en caja'));

        $this->assertSame('Recepción', $r->json('data.eventos.0.detalle'));
    }

    public function test_peso_del_cliente_es_opcional_e_informativo_y_material_del_lote(): void
    {
        $this->como($this->usuario(self::RECEPCION));

        // Sin peso del cliente: vale el de la empresa y no hay diferencia.
        $this->recibir(['material' => 'ZN-AG-PB'])->assertCreated()
            ->assertJsonPath('data.material', 'ZN-AG-PB')
            ->assertJsonPath('data.peso_cliente_kg', '8200.00')
            ->assertJsonPath('data.diferencia_cliente_kg', '0.00')
            ->assertJsonPath('data.pesajes_con_peso_cliente', 0);

        // Con peso del cliente: el lote y el bono siguen con el peso de la empresa.
        $r = $this->recibir([], $this->pesaje(['ticket' => 'T-101', 'peso_cliente_kg' => 8350]))->assertCreated()
            ->assertJsonPath('data.peso_neto_humedo_kg', '8200.00')
            ->assertJsonPath('data.peso_cliente_kg', '8350.00')
            ->assertJsonPath('data.diferencia_cliente_kg', '150.00')
            ->assertJsonPath('data.pesajes.0.peso_cliente_kg', '8350.00')
            ->assertJsonPath('data.pesajes.0.bono.monto', '80.00');

        // Un segundo pesaje sin peso del cliente suma su peso de empresa a los dos lados.
        $id = $r->json('data.id');
        $this->postJson("/api/cargas/lotes/{$id}/pesajes", $this->pesaje(['ticket' => 'T-102', 'peso_bruto_kg' => 6000, 'tara_kg' => 4000]))
            ->assertCreated();
        $this->getJson("/api/cargas/lotes/{$id}")->assertOk()
            ->assertJsonPath('data.peso_neto_humedo_kg', '10200.00')
            ->assertJsonPath('data.peso_cliente_kg', '10350.00')
            ->assertJsonPath('data.pesajes_con_peso_cliente', 1);

        // El peso del cliente no se corrige, como los de la báscula.
        $pesaje = DB::table('cargas.pesaje')->where('ticket', 'T-101')->value('id');
        $this->expectException(\Illuminate\Database\QueryException::class);
        DB::table('cargas.pesaje')->where('id', $pesaje)->update(['peso_cliente_kg' => 8200]);
    }

    public function test_material_y_peso_del_cliente_invalidos(): void
    {
        $this->como($this->usuario(self::RECEPCION));

        $this->recibir(['material' => 'CU'])->assertUnprocessable()->assertJsonValidationErrors('material');
        $this->recibir([], $this->pesaje(['peso_cliente_kg' => 0]))->assertUnprocessable()
            ->assertJsonValidationErrors('pesaje.peso_cliente_kg');

        $id = $this->recibir()->json('data.id');
        $pdf = $this->get("/api/cargas/lotes/{$id}/boleta")->assertOk();
        $this->assertSame('application/pdf', $pdf->headers->get('Content-Type'));
    }

    public function test_rotulo_con_qr_y_verificacion_publica(): void
    {
        $this->como($this->usuario(self::RECEPCION));
        $r = $this->recibir(['material' => 'ZN-AG-PB'])->assertCreated();
        $id = $r->json('data.id');
        $this->assertArrayNotHasKey('codigo_verificacion', $r->json('data'));

        $url = $r->json('data.url_verificacion');
        $this->assertMatchesRegularExpression('#/l/[0-9a-f]{32}$#', $url);
        $codigo = substr($url, -32);

        $pdf = $this->get("/api/cargas/lotes/{$id}/rotulo")->assertOk();
        $this->assertSame('application/pdf', $pdf->headers->get('Content-Type'));

        // Sin sesión: se ve el lote, sin dinero, sin CI y sin el código del QR.
        $this->app['auth']->forgetGuards();
        $v = $this->getJson("/api/cargas/verificar/{$codigo}")->assertOk()
            ->assertJsonPath('data.codigo', $r->json('data.codigo'))
            ->assertJsonPath('data.estado', 'RECIBIDO')
            ->assertJsonPath('data.material', 'ZN-AG-PB')
            ->assertJsonPath('data.peso_neto_kg', '8200.00')
            ->assertJsonPath('data.pesajes.0.ticket', 'T-100');
        $json = json_encode($v->json());
        foreach (['bono', 'monto', 'ci', 'codigo_verificacion', '4567890'] as $nada) {
            $this->assertStringNotContainsString("\"{$nada}\"", $json);
        }

        // Un código inventado no lleva a ningún lote; el código del lote tampoco sirve.
        $this->getJson('/api/cargas/verificar/' . str_repeat('a', 32))->assertNotFound();
        $this->getJson('/api/cargas/verificar/' . $r->json('data.codigo'))->assertNotFound();

        // El código de verificación no cambia.
        $this->expectException(\Illuminate\Database\QueryException::class);
        DB::table('cargas.lote')->where('id', $id)->update(['codigo_verificacion' => str_repeat('b', 32)]);
    }

    public function test_peso_del_cliente_bruto_y_correccion_con_bono_pagado(): void
    {
        // Caso real: 24.700 bruto, 12.500 tara; el cliente declara 24.500 de BRUTO.
        $this->como($this->usuario(self::RECEPCION));
        $lote = $this->recibir([], $this->pesaje(['ticket' => 'T-458', 'peso_bruto_kg' => 24700, 'tara_kg' => 12500,
            'peso_cliente_kg' => 24500, 'peso_cliente_tipo' => 'BRUTO']))->assertCreated()
            ->assertJsonPath('data.peso_neto_humedo_kg', '12000.00')      // nuestra báscula pesa más: vale el del cliente
            ->assertJsonPath('data.pesajes.0.criterio_peso', 'CLIENTE')
            ->assertJsonPath('data.peso_cliente_kg', '12000.00')          // 24.500 − 12.500
            ->assertJsonPath('data.diferencia_cliente_kg', '-200.00')
            ->json('data');
        $pesaje = $lote['pesajes'][0]['id'];

        // Un bruto declarado menor que la tara no tiene sentido.
        $this->recibir([], $this->pesaje(['ticket' => 'T-459', 'peso_cliente_kg' => 4000, 'peso_cliente_tipo' => 'BRUTO']))
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'mayor que la tara'));

        // Se paga el bono: el pesaje ya no se anula, pero el peso del cliente sí se corrige con motivo.
        [$caja] = $this->cajaAbierta(1000);
        $this->postJson("/api/cargas/bonos/{$lote['pesajes'][0]['bono']['id']}/pagar", ['caja_id' => $caja->id])->assertCreated();

        $this->como($this->usuario(self::RECEPCION));
        $this->postJson("/api/cargas/pesajes/{$pesaje}/peso-cliente", ['peso_cliente_kg' => 12100, 'peso_cliente_tipo' => 'NETO'])
            ->assertUnprocessable()->assertJsonValidationErrors('motivo');
        $this->postJson("/api/cargas/pesajes/{$pesaje}/peso-cliente",
            ['peso_cliente_kg' => 12100, 'peso_cliente_tipo' => 'NETO', 'motivo' => 'El cliente presentó su ticket neto'])
            ->assertOk()->assertJsonPath('data.correcciones_cliente.0.anterior_kg', '24500.00');

        $ficha = $this->getJson("/api/cargas/lotes/{$lote['id']}")->assertOk()
            ->assertJsonPath('data.peso_cliente_kg', '12100.00')
            ->assertJsonPath('data.diferencia_cliente_kg', '-100.00')
            ->assertJsonPath('data.pesajes.0.correcciones_cliente.0.motivo', 'El cliente presentó su ticket neto');
        $this->assertSame('BRUTO', $ficha->json('data.pesajes.0.correcciones_cliente.0.anterior_tipo'));

        // Lo demás del pesaje sigue fijo, y por fuera de la función tampoco se toca el peso del cliente.
        $this->expectException(\Illuminate\Database\QueryException::class);
        DB::table('cargas.pesaje')->where('id', $pesaje)->update(['peso_cliente_kg' => 1]);
    }

    public function test_la_serie_decide_que_datos_exige(): void
    {
        $this->como($this->usuario(self::RECEPCION));

        $this->recibir(['productor_id' => null])->assertStatus(422)->assertJsonValidationErrors('productor_id');

        $propia = ['serie_id' => $this->serie('BM'), 'productor_id' => null, 'mina_id' => $this->minaPropia->id];
        $this->recibir($propia)->assertStatus(422)->assertJsonValidationErrors('bocamina_id');
        $this->recibir([...$propia, 'productor_id' => $this->productor->id, 'bocamina_id' => $this->bocamina->id])
            ->assertStatus(422)->assertJsonValidationErrors('productor_id');

        $this->recibir([...$propia, 'bocamina_id' => $this->bocamina->id])->assertCreated()
            ->assertJsonPath('data.origen', 'PROPIA')
            ->assertJsonPath('data.codigo', 'BM-' . now()->format('Ym') . '-0001');

        // La base: mineral de mina propia no entra por una serie de compra.
        $this->recibir(['mina_id' => $this->minaPropia->id])->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'es propia'));
    }

    public function test_sin_pesaje_tambien_se_recibe_y_sin_permiso_no(): void
    {
        $this->como($this->usuario(['cargas.ver']));
        $this->recibir()->assertForbidden();

        $this->como($this->usuario(self::RECEPCION));
        $this->recibir([], [])->assertCreated()->assertJsonPath('data.num_pesajes', 0);
        $this->recibir(['almacen_id' => 2])->assertStatus(422)->assertJsonValidationErrors('almacen_id');
    }

    public function test_pesajes_validan_tara_ticket_y_chofer(): void
    {
        $this->como($this->usuario(self::RECEPCION));
        $lote = $this->recibir()->json('data.id');

        $this->postJson("/api/cargas/lotes/{$lote}/pesajes", $this->pesaje(['ticket' => 'T-101', 'tara_kg' => 12500]))
            ->assertStatus(422)->assertJsonValidationErrors('tara_kg');
        $this->postJson("/api/cargas/lotes/{$lote}/pesajes", $this->pesaje(['ticket' => 'T-101', 'chofer_nombre' => null]))
            ->assertStatus(422)->assertJsonValidationErrors('chofer_nombre');
        $this->postJson("/api/cargas/lotes/{$lote}/pesajes", $this->pesaje())     // mismo ticket T-100 en la misma báscula
            ->assertStatus(422)->assertJsonPath('message', 'Ese ticket de báscula ya está registrado.');

        $this->postJson("/api/cargas/lotes/{$lote}/pesajes", $this->pesaje(['ticket' => 'T-101', 'peso_bruto_kg' => 4600, 'tara_kg' => 4300]))
            ->assertCreated()->assertJsonPath('data.bono', null)        // 300 kg: sin tramo
            ->assertJsonPath('data.peso_neto_kg', '300.00');

        $this->getJson("/api/cargas/lotes/{$lote}")->assertOk()
            ->assertJsonPath('data.num_pesajes', 2)
            ->assertJsonPath('data.peso_neto_humedo_kg', '8500.00');
    }

    public function test_anular_un_pesaje_anula_su_bono_pendiente(): void
    {
        $this->como($this->usuario(self::RECEPCION));
        $lote = $this->recibir()->json('data');
        $pesaje = $lote['pesajes'][0]['id'];

        $this->postJson("/api/cargas/pesajes/{$pesaje}/anular", ['motivo' => 'corto'])->assertStatus(422);
        $this->postJson("/api/cargas/pesajes/{$pesaje}/anular", ['motivo' => 'Se pesó el camión equivocado'])->assertOk()
            ->assertJsonPath('data.anulado', true)
            ->assertJsonPath('data.bono.estado', 'ANULADO');
    }

    // --------------------------------------------------------- Pago de bono

    public function test_el_cajero_paga_el_bono_y_queda_vinculado_al_egreso(): void
    {
        $this->como($this->usuario(self::RECEPCION));
        $lote = $this->recibir()->json('data');
        $bono = $lote['pesajes'][0]['bono']['id'];

        [$caja] = $this->cajaAbierta(1000);
        $this->getJson("/api/cargas/bonos/pendientes?caja_id={$caja->id}")->assertOk()->assertJsonCount(1, 'data');

        $mov = $this->postJson("/api/cargas/bonos/{$bono}/pagar", ['caja_id' => $caja->id])->assertCreated()
            ->assertJsonPath('data.concepto.codigo', 'BONO_TRANSPORTE')
            ->assertJsonPath('data.monto', '80.00')
            ->assertJsonPath('data.persona_nombre', 'PEDRO QUISPE')
            ->json('data');

        $this->assertSame('PAGADO', DB::table('cargas.bono_transporte')->where('id', $bono)->value('estado'));
        $this->assertSame($mov['id'], DB::table('cargas.bono_transporte')->where('id', $bono)->value('movimiento_caja_id'));
        $this->assertSame(920.0, (float) DB::selectOne("select caja.saldo_efectivo(?, 'BOB') as s", [$mov['sesion_id']])->s);

        $this->postJson("/api/cargas/bonos/{$bono}/pagar", ['caja_id' => $caja->id])->assertStatus(422)
            ->assertJsonPath('message', 'El bono ya está PAGADO.');

        // Desde caja no se anula: el egreso respalda un bono.
        $this->postJson("/api/caja/movimientos/{$mov['id']}/anular", ['motivo' => 'Pagado por error al chofer'])->assertForbidden();

        // Y el pesaje con bono pagado ya no se anula.
        $this->como($this->usuario(self::RECEPCION));
        $this->postJson("/api/cargas/pesajes/{$lote['pesajes'][0]['id']}/anular", ['motivo' => 'Se pesó el camión equivocado'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'ya se pagó'));
    }

    public function test_el_bono_se_paga_en_una_caja_abierta_de_la_misma_sede_y_con_saldo(): void
    {
        $this->como($this->usuario(self::RECEPCION));
        $bono = $this->recibir()->json('data.pesajes.0.bono.id');

        [$porco] = $this->cajaAbierta(1000, 2, 'PRC');
        $this->postJson("/api/cargas/bonos/{$bono}/pagar", ['caja_id' => $porco->id])->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'se recibió en otra sede'));

        [$pobre] = $this->cajaAbierta(50, 1, 'PTS');
        $this->postJson("/api/cargas/bonos/{$bono}/pagar", ['caja_id' => $pobre->id])->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_starts_with($m, 'Saldo insuficiente'));
        $this->assertSame('PENDIENTE', DB::table('cargas.bono_transporte')->where('id', $bono)->value('estado'));
        $this->assertSame(0, DB::table('caja.movimiento')->count(), 'Si el pago falla no queda el egreso.');

        $this->como($this->usuario(self::CAJERO));        // con permiso pero sin estar asignado
        $this->postJson("/api/cargas/bonos/{$bono}/pagar", ['caja_id' => $pobre->id])->assertForbidden();
    }

    // ----------------------------------------------------------- Anulación

    public function test_anular_el_lote_anula_sus_bonos_pendientes(): void
    {
        $this->como($this->usuario(self::RECEPCION));
        $lote = $this->recibir()->json('data');
        $this->postJson("/api/cargas/lotes/{$lote['id']}/anular", ['motivo' => 'Carga rechazada por calidad'])->assertForbidden();

        $this->como($this->usuario([...self::RECEPCION, 'cargas.anular-lote']));
        $this->postJson("/api/cargas/lotes/{$lote['id']}/anular", ['motivo' => 'Carga rechazada por calidad'])->assertOk()
            ->assertJsonPath('data.estado', 'ANULADO')
            ->assertJsonPath('data.pesajes.0.bono.estado', 'ANULADO')
            ->assertJsonPath('data.eventos.1.estado_nuevo', 'ANULADO');

        $this->postJson("/api/cargas/lotes/{$lote['id']}/pesajes", $this->pesaje(['ticket' => 'T-200']))
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'ANULADO'));
    }

    // ------------------------------------------------- Listado y boleta

    public function test_listado_por_sede_y_boleta(): void
    {
        $this->como($this->usuario(self::RECEPCION, [1, 2]));
        $this->recibir();
        $this->recibir(['almacen_id' => 2], $this->pesaje(['ticket' => 'T-900']));

        $this->como($this->usuario(self::RECEPCION, [1]));
        $this->getJson('/api/cargas/lotes')->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/cargas/lotes?buscar=mamani')->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/cargas/lotes?estado=ANULADO')->assertOk()->assertJsonPath('total', 0);

        $id = $this->getJson('/api/cargas/lotes')->json('data.0.id');
        $pdf = $this->get("/api/cargas/lotes/{$id}/boleta")->assertOk();
        $this->assertSame('application/pdf', $pdf->headers->get('Content-Type'));

        $otro = DB::table('cargas.lote')->where('almacen_id', 2)->value('id');
        $this->getJson("/api/cargas/lotes/{$otro}")->assertForbidden();
    }

    // --------------------------------------------------------------- Tramos

    public function test_publicar_una_tabla_de_tramos(): void
    {
        $this->como($this->usuario(self::RECEPCION));
        $this->getJson('/api/cargas/bono-tramos/calcular?peso_neto_kg=8200')->assertOk()->assertJsonPath('data.monto', '80.00');
        $this->postJson('/api/cargas/bono-tramos', [])->assertForbidden();

        $this->como($this->usuario(['cargas.ver', 'cargas.configurar-bono']));
        $manana = now()->addDay()->toDateString();

        $this->postJson('/api/cargas/bono-tramos', ['vigente_desde' => now()->subDay()->toDateString(), 'tramos' => [
            ['tipo_vehiculo' => 'TONKA', 'peso_desde_kg' => 500, 'peso_hasta_kg' => 7000, 'monto' => 60],
        ]])->assertStatus(422)->assertJsonValidationErrors('vigente_desde');

        $this->postJson('/api/cargas/bono-tramos', ['vigente_desde' => $manana, 'tramos' => [
            ['tipo_vehiculo' => 'TONKA', 'peso_desde_kg' => 500, 'peso_hasta_kg' => 7500, 'monto' => 60],
            ['tipo_vehiculo' => 'SENCILLO', 'peso_desde_kg' => 7000, 'peso_hasta_kg' => null, 'monto' => 90],
        ]])->assertStatus(422)->assertJsonValidationErrors('tramos');

        $this->postJson('/api/cargas/bono-tramos', ['vigente_desde' => $manana, 'tramos' => [
            ['tipo_vehiculo' => 'tonka', 'peso_desde_kg' => 500, 'peso_hasta_kg' => 7000, 'monto' => 60],
            ['tipo_vehiculo' => 'sencillo', 'peso_desde_kg' => 7000, 'peso_hasta_kg' => null, 'monto' => 90],
        ]])->assertCreated();

        $tablas = collect($this->getJson('/api/cargas/bono-tramos')->assertOk()->json('data'));
        $this->assertSame(['PROXIMA', 'VIGENTE'], $tablas->pluck('estado')->all());
        $this->assertSame($manana, $tablas[1]['vigente_hasta']);
        $this->assertSame('TONKA', $tablas[0]['tramos'][0]['tipo_vehiculo']);

        // Hoy sigue rigiendo la tabla anterior.
        $this->getJson('/api/cargas/bono-tramos/calcular?peso_neto_kg=8200')->assertJsonPath('data.monto', '80.00');
    }
}
