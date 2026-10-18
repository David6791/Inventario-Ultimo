<?php

namespace Tests\Feature\Caja;

use App\Models\User;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Concepto;
use App\Modules\Comun\Models\Banco;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\Feature\Cargas\PreparaBaseCargas;
use Tests\TestCase;

/**
 * Sprint 2 — Caja I: cajas, conceptos, apertura, movimientos, anulación y
 * comprobante. Las reglas de fondo están en la base; aquí se prueba que la
 * API las expone bien (422 con el mensaje en español) y que respeta los
 * permisos y las sedes.
 */
class CajaApiTest extends TestCase
{
    use PreparaBaseCargas;
    use RefreshDatabase;

    private const CAJERO = ['caja.ver', 'caja.abrir', 'caja.registrar', 'caja.anular'];
    private const ADMIN = ['caja.ver', 'caja.administrar'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
        $this->filaConId('almacenes', 2);
    }

    // ------------------------------------------------------------- Ayudas

    /**
     * Usuario con esos permisos. Si puede operar caja (abrir, registrar o
     * anular), queda asignado como cajero de las cajas que ya existen, salvo
     * que se indiquen otras en $cajeroDe.
     */
    private function usuario(array $permisos, array $almacenes = [1], ?array $cajeroDe = null): User
    {
        $usuario = User::factory()->create();
        $usuario->givePermissionTo($permisos);
        $usuario->almacenes()->sync($almacenes);

        $opera = array_intersect($permisos, ['caja.abrir', 'caja.registrar', 'caja.anular']) !== [];
        $cajas = $cajeroDe ?? ($opera ? Caja::pluck('id')->all() : []);
        foreach ($cajas as $caja) {
            DB::table('caja.caja_cajero')->insert(['caja_id' => $caja instanceof Caja ? $caja->id : $caja, 'user_id' => $usuario->id]);
        }

        return $usuario;
    }

    private function como(User $usuario): User
    {
        Sanctum::actingAs($usuario->fresh());

        return $usuario;
    }

    private function caja(string $codigo = 'PTS', int $almacen = 1, bool $usd = false): Caja
    {
        return Caja::create([
            'codigo' => $codigo, 'nombre' => "Caja {$codigo}", 'almacen_id' => $almacen,
            'maneja_usd' => $usd, 'formato_comprobante' => '{CAJA}-{AAAA}-{N:5}', 'reinicio_comprobante' => 'ANUAL',
        ]);
    }

    private function concepto(string $codigo): Concepto
    {
        return Concepto::where('codigo', $codigo)->firstOrFail();
    }

    private function abrir(Caja $caja, array $saldos = ['BOB' => 1000]): int
    {
        return $this->postJson("/api/caja/cajas/{$caja->id}/sesiones", ['saldo_inicial' => $saldos])
            ->assertCreated()->json('data.id');
    }

    private function movimiento(int $sesion, string $concepto, float $monto, array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson("/api/caja/sesiones/{$sesion}/movimientos", [
            'concepto_id' => $this->concepto($concepto)->id, 'monto' => $monto, 'moneda' => 'BOB',
            'forma_pago' => 'EFECTIVO', 'persona_nombre' => 'juan pérez', 'glosa' => 'Movimiento de prueba', ...$extra,
        ]);
    }

    private function saldoEfectivo(int $sesion, string $moneda = 'BOB'): float
    {
        return (float) DB::selectOne('select caja.saldo_efectivo(?, ?) as s', [$sesion, $moneda])->s;
    }

    /** El cierre llega en el sprint 3: aquí se simula directo en la base. */
    private function cerrar(int $sesion, array $contado): void
    {
        $cajero = DB::table('caja.sesion')->where('id', $sesion)->value('abierta_por');
        Transaccion::como($cajero, function () use ($sesion, $contado, $cajero) {
            foreach ($contado as $moneda => $monto) {
                DB::table('caja.sesion_saldo')->where(['sesion_id' => $sesion, 'moneda' => $moneda])->update(['saldo_contado' => $monto]);
            }
            DB::table('caja.sesion')->where('id', $sesion)->update([
                'estado' => 'CERRADA', 'cerrada_por' => $cajero, 'cerrada_en' => now(),
                'observaciones' => 'Cierre de prueba con diferencia explicada.',
            ]);
        });
    }

    // ------------------------------------------------------------- Cajas

    public function test_el_administrador_crea_una_caja_y_ve_su_proximo_comprobante(): void
    {
        $this->como($this->usuario(self::ADMIN));

        $this->postJson('/api/caja/cajas', [
            'codigo' => ' pts ', 'nombre' => 'Caja  central Potosí', 'almacen_id' => 1, 'maneja_usd' => true,
            'formato_comprobante' => '{CAJA}-{AA}{MM}-{N:4}', 'reinicio_comprobante' => 'mensual',
        ])->assertCreated()->assertJsonPath('data.codigo', 'PTS')->assertJsonPath('data.nombre', 'Caja central Potosí');

        $caja = collect($this->getJson('/api/caja/cajas')->assertOk()->json('data'))->firstWhere('codigo', 'PTS');
        $this->assertSame('PTS-' . now()->format('ym') . '-0001', $caja['proximo_numero']);
        $this->assertNull($caja['sesion_abierta']);
    }

    public function test_formato_de_comprobante_invalido_se_rechaza_con_el_motivo(): void
    {
        $this->como($this->usuario(self::ADMIN));

        $this->postJson('/api/caja/cajas', [
            'codigo' => 'PTS', 'nombre' => 'Caja', 'almacen_id' => 1,
            'formato_comprobante' => '{CAJA}-{N:6}', 'reinicio_comprobante' => 'ANUAL',
        ])->assertStatus(422)->assertJsonPath('errors.formato_comprobante.0',
            fn ($m) => str_starts_with($m, 'Con reinicio ANUAL el formato debe mostrar el año'));

        $this->postJson('/api/caja/cajas/vista-previa', [
            'codigo' => 'prc', 'formato_comprobante' => 'E{CAJA}/{AAAA}/{N:6}', 'reinicio_comprobante' => 'ANUAL', 'fecha' => '2026-11-20',
        ])->assertOk()->assertJsonPath('data.numero', 'EPRC/2026/000001');
    }

    public function test_sin_caja_administrar_no_se_crean_cajas(): void
    {
        $this->como($this->usuario(self::CAJERO));

        $this->postJson('/api/caja/cajas', [
            'codigo' => 'PTS', 'nombre' => 'Caja', 'almacen_id' => 1,
            'formato_comprobante' => '{CAJA}-{AAAA}-{N:6}', 'reinicio_comprobante' => 'ANUAL',
        ])->assertForbidden();
    }

    public function test_una_caja_con_sesiones_no_cambia_de_codigo_ni_de_sede(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $this->abrir($caja);

        $this->como($this->usuario(self::ADMIN));
        $this->putJson("/api/caja/cajas/{$caja->id}", [
            ...$caja->only(['nombre', 'formato_comprobante', 'reinicio_comprobante']), 'codigo' => 'POT', 'almacen_id' => 2,
        ])->assertStatus(422)->assertJsonValidationErrors(['codigo', 'almacen_id']);
    }

    public function test_no_se_dejan_de_manejar_dolares_con_una_sesion_abierta_en_dolares(): void
    {
        $caja = $this->caja('PTS', 1, true);
        $this->como($this->usuario(self::CAJERO));
        $this->abrir($caja, ['BOB' => 100, 'USD' => 50]);

        $this->como($this->usuario(self::ADMIN));
        $this->putJson("/api/caja/cajas/{$caja->id}", [
            ...$caja->only(['codigo', 'nombre', 'almacen_id', 'formato_comprobante', 'reinicio_comprobante']), 'maneja_usd' => false,
        ])->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'tiene saldo en dólares'));
    }

    public function test_el_cajero_solo_ve_las_cajas_de_su_sede_o_las_que_tiene_asignadas(): void
    {
        $potosi = $this->caja('PTS', 1);
        $porco = $this->caja('PRC', 2);
        $oruro = $this->caja('ORU', 2);
        $this->como($this->usuario(self::CAJERO, [1], [$potosi, $oruro]));

        $cajas = collect($this->getJson('/api/caja/cajas')->assertOk()->json('data'));
        $this->assertSame(['ORU', 'PTS'], $cajas->pluck('codigo')->sort()->values()->all());
        $this->assertTrue($cajas->firstWhere('codigo', 'ORU')['soy_cajero']);

        $this->getJson("/api/caja/cajas/{$porco->id}")->assertForbidden();
        $this->postJson("/api/caja/cajas/{$porco->id}/sesiones", ['saldo_inicial' => ['BOB' => 10]])->assertForbidden();
    }

    // ------------------------------------------------------------- Cajeros

    public function test_solo_los_cajeros_asignados_operan_la_caja(): void
    {
        $caja = $this->caja();
        $titular = $this->usuario(self::CAJERO, [1], [$caja]);
        $otro = $this->usuario(self::CAJERO, [1], []);     // misma sede y permisos, sin asignar

        $this->como($otro);
        $this->getJson("/api/caja/cajas/{$caja->id}")->assertOk()->assertJsonPath('data.soy_cajero', false);
        $this->postJson("/api/caja/cajas/{$caja->id}/sesiones", ['saldo_inicial' => ['BOB' => 10]])
            ->assertForbidden()->assertJsonPath('message', fn ($m) => str_contains($m, 'No está asignado como cajero de la caja PTS'));

        $this->como($titular);
        $sesion = $this->abrir($caja);
        $id = $this->movimiento($sesion, 'GASTOS_MENORES', 10)->assertCreated()->json('data.id');

        $this->como($otro);
        $this->movimiento($sesion, 'GASTOS_MENORES', 10)->assertForbidden();
        $this->postJson("/api/caja/movimientos/{$id}/anular", ['motivo' => 'Se registró en la caja equivocada'])->assertForbidden();

        // La base también lo exige, aunque se salte la API.
        $this->expectExceptionMessage('no está asignado como cajero de la caja PTS');
        Transaccion::como($otro->id, fn () => DB::table('caja.sesion')->where('id', $sesion)->update([
            'estado' => 'CERRADA', 'cerrada_por' => $otro->id, 'cerrada_en' => now(),
        ]));
    }

    public function test_el_administrador_asigna_los_cajeros(): void
    {
        $caja = $this->caja();
        $ana = $this->usuario(self::CAJERO, [1], []);
        $beto = $this->usuario(self::CAJERO, [1], []);
        $this->como($this->usuario(self::ADMIN));

        $opciones = collect($this->getJson('/api/caja/opciones')->assertOk()->json('data.usuarios'))->pluck('id');
        $this->assertTrue($opciones->contains($ana->id) && $opciones->contains($beto->id));

        $this->putJson("/api/caja/cajas/{$caja->id}/cajeros", ['usuarios' => [$ana->id, $beto->id]])
            ->assertOk()->assertJsonCount(2, 'data');
        $this->putJson("/api/caja/cajas/{$caja->id}/cajeros", ['usuarios' => [$beto->id]])->assertOk();

        $this->assertSame([$beto->id], DB::table('caja.caja_cajero')->where('caja_id', $caja->id)->pluck('user_id')->all());

        $this->como($ana);
        $this->putJson("/api/caja/cajas/{$caja->id}/cajeros", ['usuarios' => [$ana->id]])->assertForbidden();
    }

    // ------------------------------------------------------------ Personas

    public function test_cada_movimiento_queda_en_el_registro_de_personas(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja, ['BOB' => 1000]);

        // Persona nueva: la registra la base. Con el mismo CI, es la misma persona.
        $p1 = $this->movimiento($sesion, 'COMBUSTIBLE', 100, ['persona_nombre' => 'juan  pérez', 'persona_ci' => '4123456'])
            ->assertCreated()->json('data.persona_id');
        $p2 = $this->movimiento($sesion, 'COMBUSTIBLE', 50, ['persona_nombre' => 'Juan Perez M.', 'persona_ci' => '4123456'])
            ->assertCreated()->assertJsonPath('data.persona_nombre', 'JUAN PÉREZ')->json('data.persona_id');
        $this->assertSame($p1, $p2);

        // Elegida del registro: no hace falta escribir el nombre.
        $this->movimiento($sesion, 'REPOSICION_FONDOS', 20, ['persona_id' => $p1, 'persona_nombre' => null])
            ->assertCreated()->assertJsonPath('data.persona_ci', '4123456');

        // Sin CI, se reconoce por el nombre.
        $sinCi = $this->movimiento($sesion, 'GASTOS_MENORES', 5, ['persona_nombre' => 'Librería Central'])->json('data.persona_id');
        $this->assertSame($sinCi, $this->movimiento($sesion, 'GASTOS_MENORES', 5, ['persona_nombre' => 'LIBRERÍA  central'])->json('data.persona_id'));

        $this->getJson('/api/caja/personas?buscar=perez')->assertOk()
            ->assertJsonPath('data.0.nombre', 'JUAN PÉREZ')
            ->assertJsonPath('data.0.movimientos', 3)
            ->assertJsonPath('data.0.totales.0.total_egresos', '150.00')
            ->assertJsonPath('data.0.totales.0.total_ingresos', '20.00');

        $this->getJson("/api/caja/personas/{$p1}")->assertOk()->assertJsonCount(3, 'data.movimientos');
        $this->getJson('/api/caja/personas?buscar=libreria&limite=5')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_corregir_una_persona_no_cambia_los_comprobantes_emitidos(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja);
        $mov = $this->movimiento($sesion, 'COMBUSTIBLE', 10, ['persona_nombre' => 'Surtidor Porko'])->json('data');

        $this->como($this->usuario(self::ADMIN));
        $this->putJson("/api/caja/personas/{$mov['persona_id']}", ['nombre' => 'Surtidor Porco', 'ci' => '1020304015'])
            ->assertOk()->assertJsonPath('data.nombre', 'SURTIDOR PORCO');

        $this->assertSame('SURTIDOR PORKO', DB::table('caja.movimiento')->where('id', $mov['id'])->value('persona_nombre'));
    }

    // ------------------------------------------------------------ Apertura

    public function test_la_primera_apertura_usa_el_saldo_digitado_y_no_se_abre_dos_veces(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));

        $this->getJson("/api/caja/cajas/{$caja->id}")->assertOk()->assertJsonPath('data.saldos_arranque.BOB', null);

        $sesion = $this->abrir($caja, ['BOB' => 1500.50]);
        $this->assertSame(1500.50, $this->saldoEfectivo($sesion));

        $this->postJson("/api/caja/cajas/{$caja->id}/sesiones", ['saldo_inicial' => ['BOB' => 1]])
            ->assertStatus(422)->assertJsonPath('message', 'La caja ya tiene una sesión abierta: ciérrela antes de abrir otra.');
    }

    public function test_la_siguiente_apertura_arranca_con_lo_contado_al_cerrar(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $primera = $this->abrir($caja, ['BOB' => 1000]);
        $this->cerrar($primera, ['BOB' => 980]);

        $this->getJson("/api/caja/cajas/{$caja->id}")->assertOk()->assertJsonPath('data.saldos_arranque.BOB', '980.00');

        // Lo que digite el cajero no cuenta: manda lo contado.
        $segunda = $this->abrir($caja, ['BOB' => 5000]);
        $this->assertSame(980.0, $this->saldoEfectivo($segunda));
    }

    // --------------------------------------------------------- Movimientos

    public function test_ingreso_y_egreso_mueven_el_saldo_y_numeran_el_comprobante(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja, ['BOB' => 100]);

        $this->movimiento($sesion, 'REPOSICION_FONDOS', 500)->assertCreated()
            ->assertJsonPath('data.numero', 'PTS-' . now()->format('Y') . '-00001')
            ->assertJsonPath('data.tipo', 'INGRESO')
            ->assertJsonPath('data.persona_nombre', 'JUAN PÉREZ');

        $this->movimiento($sesion, 'SERVICIOS_BASICOS', 120.40)->assertCreated()
            ->assertJsonPath('data.tipo', 'EGRESO')
            ->assertJsonPath('saldos.0.saldo_efectivo_actual', '479.60');
    }

    public function test_un_egreso_mayor_al_efectivo_se_rechaza(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja, ['BOB' => 100]);

        $this->movimiento($sesion, 'COMBUSTIBLE', 100.01)->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_starts_with($m, 'Saldo insuficiente en caja: hay 100.00 BOB'));

        $this->assertSame(0, DB::table('caja.movimiento')->count());
    }

    public function test_cheque_exige_banco_y_no_mueve_el_efectivo(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja, ['BOB' => 100]);

        $this->movimiento($sesion, 'COMBUSTIBLE', 5000, ['forma_pago' => 'CHEQUE'])
            ->assertStatus(422)->assertJsonValidationErrors(['banco_id', 'nro_documento']);

        $banco = Banco::create(['nombre' => 'BANCO UNIÓN']);
        $this->movimiento($sesion, 'COMBUSTIBLE', 5000, ['forma_pago' => 'CHEQUE', 'banco_id' => $banco->id, 'nro_documento' => '000123'])
            ->assertCreated();

        $this->assertSame(100.0, $this->saldoEfectivo($sesion));
    }

    public function test_los_conceptos_de_cargas_no_se_eligen_a_mano(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja);

        $this->movimiento($sesion, 'ANTICIPO_COMPRA', 50)->assertStatus(422)
            ->assertJsonPath('errors.concepto_id.0', fn ($m) => str_contains($m, 'Los anticipos y bonos se pagan desde cargas'));
    }

    public function test_dolares_solo_en_una_caja_que_los_maneja(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja);

        $this->movimiento($sesion, 'REPOSICION_FONDOS', 10, ['moneda' => 'USD'])->assertStatus(422)
            ->assertJsonPath('message', 'La sesión no tiene saldo abierto en USD.');
    }

    public function test_sin_caja_registrar_no_se_registran_movimientos(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja);

        $this->como($this->usuario(['caja.ver']));
        $this->movimiento($sesion, 'REPOSICION_FONDOS', 10)->assertForbidden();
    }

    // ------------------------------------------------------------ Anulación

    public function test_anular_devuelve_el_saldo_y_no_se_anula_dos_veces(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja, ['BOB' => 300]);
        $id = $this->movimiento($sesion, 'GASTOS_MENORES', 200)->json('data.id');

        $this->postJson("/api/caja/movimientos/{$id}/anular", ['motivo' => 'corto'])
            ->assertStatus(422)->assertJsonValidationErrors('motivo');

        $this->postJson("/api/caja/movimientos/{$id}/anular", ['motivo' => 'Se registró en la caja equivocada'])
            ->assertOk()->assertJsonPath('data.estado', 'ANULADO')->assertJsonPath('saldos.0.saldo_efectivo_actual', '300.00');

        $this->postJson("/api/caja/movimientos/{$id}/anular", ['motivo' => 'Otra vez el mismo comprobante'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'ya está anulado'));
    }

    public function test_no_se_anula_un_ingreso_que_ya_se_gasto(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja, ['BOB' => 0]);
        $ingreso = $this->movimiento($sesion, 'REPOSICION_FONDOS', 500)->json('data.id');
        $this->movimiento($sesion, 'COMBUSTIBLE', 400)->assertCreated();

        $this->postJson("/api/caja/movimientos/{$ingreso}/anular", ['motivo' => 'El depósito no llegó a caja'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_starts_with($m, 'Anular este ingreso dejaría la caja en negativo'));
    }

    public function test_con_la_sesion_cerrada_no_se_anula_ni_se_registra(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja, ['BOB' => 300]);
        $id = $this->movimiento($sesion, 'GASTOS_MENORES', 50)->json('data.id');
        $this->cerrar($sesion, ['BOB' => 250]);

        $this->postJson("/api/caja/movimientos/{$id}/anular", ['motivo' => 'Se registró en la caja equivocada'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'está CERRADA: no admite movimientos'));

        $this->movimiento($sesion, 'GASTOS_MENORES', 10)->assertStatus(422);
    }

    public function test_sin_caja_anular_no_se_anula(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja);
        $id = $this->movimiento($sesion, 'GASTOS_MENORES', 50)->json('data.id');

        $this->como($this->usuario(['caja.ver', 'caja.registrar']));
        $this->postJson("/api/caja/movimientos/{$id}/anular", ['motivo' => 'Se registró en la caja equivocada'])->assertForbidden();
    }

    // ---------------------------------------------------------- Comprobante

    public function test_el_comprobante_sale_en_pdf(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja, ['BOB' => 2000]);
        $id = $this->movimiento($sesion, 'SERVICIOS_BASICOS', 1250.5)->assertCreated()->json('data.id');

        $respuesta = $this->get("/api/caja/movimientos/{$id}/comprobante")->assertOk();
        $this->assertSame('application/pdf', $respuesta->headers->get('Content-Type'));
        $this->assertStringStartsWith('%PDF', $respuesta->getContent());
    }

    // ------------------------------------------------------------ Conceptos

    public function test_conceptos_manuales_se_crean_y_los_de_cargas_no_se_editan(): void
    {
        $this->como($this->usuario(self::ADMIN));

        $this->postJson('/api/caja/conceptos', ['codigo' => 'pago sueldos', 'nombre' => 'Pago de sueldos', 'tipo' => 'egreso'])
            ->assertCreated()->assertJsonPath('data.codigo', 'PAGO_SUELDOS')->assertJsonPath('data.origen', 'MANUAL');

        $this->postJson('/api/caja/conceptos', ['codigo' => 'OTRO', 'nombre' => 'pago  de SUELDOS', 'tipo' => 'EGRESO'])
            ->assertStatus(422)->assertJsonPath('message', 'Ya existe un concepto con ese nombre.');

        $anticipo = $this->concepto('ANTICIPO_COMPRA');
        $this->putJson("/api/caja/conceptos/{$anticipo->id}", ['codigo' => 'ANTICIPO_COMPRA', 'nombre' => 'Otro nombre', 'tipo' => 'EGRESO'])
            ->assertStatus(422)->assertJsonPath('errors.codigo.0', fn ($m) => str_contains($m, 'no se edita desde caja'));

        $lista = collect($this->getJson('/api/caja/conceptos')->assertOk()->json('data'));
        $this->assertTrue($lista->contains('codigo', 'BONO_TRANSPORTE'));
    }

    public function test_un_concepto_con_movimientos_no_cambia_de_tipo(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja);
        $this->movimiento($sesion, 'GASTOS_MENORES', 10)->assertCreated();

        $this->como($this->usuario(self::ADMIN));
        $gastos = $this->concepto('GASTOS_MENORES');
        $this->putJson("/api/caja/conceptos/{$gastos->id}", ['codigo' => 'GASTOS_MENORES', 'nombre' => $gastos->nombre, 'tipo' => 'INGRESO'])
            ->assertStatus(422)->assertJsonValidationErrors('tipo');
    }

    public function test_avisa_cuando_el_nombre_ya_existe_con_otro_ci(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja);
        $this->movimiento($sesion, 'COMBUSTIBLE', 10, ['persona_nombre' => 'Joaquín Manrique', 'persona_ci' => '6698509']);

        $this->getJson('/api/caja/personas/coincidencias?nombre=joaquín%20manrique&ci=6698508')->assertOk()
            ->assertJsonPath('data.mismo_nombre.0.ci', '6698509')
            ->assertJsonPath('data.mismo_ci', null);

        $this->getJson('/api/caja/personas/coincidencias?nombre=Otro&ci=6698509')->assertOk()
            ->assertJsonCount(0, 'data.mismo_nombre')
            ->assertJsonPath('data.mismo_ci.nombre', 'JOAQUÍN MANRIQUE');
    }

    public function test_unificar_pasa_los_movimientos_y_conserva_los_comprobantes(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO));
        $sesion = $this->abrir($caja, ['BOB' => 1000]);
        $bueno = $this->movimiento($sesion, 'COMBUSTIBLE', 100, ['persona_nombre' => 'Joaquín Manrique', 'persona_ci' => '6698509'])->json('data');
        $malo = $this->movimiento($sesion, 'COMBUSTIBLE', 30, ['persona_nombre' => 'Joaquín Manrique', 'persona_ci' => '6698508'])->json('data');
        $this->postJson("/api/caja/movimientos/{$malo['id']}/anular", ['motivo' => 'Prueba de anulado que también se mueve'])->assertOk();
        $this->movimiento($sesion, 'COMBUSTIBLE', 20, ['persona_nombre' => 'Joaquín Manrique', 'persona_ci' => '6698508']);
        $this->cerrar($sesion, ['BOB' => 880]);      // también se reasignan movimientos de una sesión cerrada

        $lista = collect($this->getJson('/api/caja/personas?buscar=manrique')->json('data'));
        $this->assertSame([1, 1], $lista->pluck('homonimos')->all());

        $this->como($this->usuario(self::CAJERO));
        $this->postJson("/api/caja/personas/{$malo['persona_id']}/unificar", ['destino_id' => $bueno['persona_id']])->assertForbidden();

        $this->como($this->usuario(self::ADMIN));
        $this->postJson("/api/caja/personas/{$malo['persona_id']}/unificar", ['destino_id' => $malo['persona_id']])
            ->assertStatus(422)->assertJsonValidationErrors('destino_id');
        $this->postJson("/api/caja/personas/{$malo['persona_id']}/unificar", ['destino_id' => $bueno['persona_id'], 'motivo' => 'CI mal digitado'])
            ->assertOk()->assertJsonPath('mensaje', fn ($m) => str_starts_with($m, 'Unificado: 2 movimiento(s)'));

        $this->assertDatabaseMissing('caja.persona', ['id' => $malo['persona_id']]);
        $this->assertSame(3, DB::table('caja.movimiento')->where('persona_id', $bueno['persona_id'])->count());
        $this->assertSame('6698508', DB::table('caja.movimiento')->where('id', $malo['id'])->value('persona_ci'));
        $this->assertSame(1, DB::table('caja.persona_unificacion')->where('destino_id', $bueno['persona_id'])->count());

        // Las reglas de los movimientos siguen activas después de unificar.
        $this->expectExceptionMessage('no admite movimientos');
        Transaccion::como(1, fn () => DB::table('caja.movimiento')->where('id', $bueno['id'])->update(['monto' => 1]));
    }
}
