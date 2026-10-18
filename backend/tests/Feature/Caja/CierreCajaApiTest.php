<?php

namespace Tests\Feature\Caja;

use App\Models\User;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Concepto;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\Feature\Cargas\PreparaBaseCargas;
use Tests\TestCase;

/**
 * Sprint 3 — Caja II: cierre con arqueo, cierre diario, validación por un
 * supervisor, reporte diario y libro de caja.
 */
class CierreCajaApiTest extends TestCase
{
    use PreparaBaseCargas;
    use RefreshDatabase;

    private const CAJERO = ['caja.ver', 'caja.abrir', 'caja.registrar', 'caja.anular', 'caja.cerrar'];
    private const SUPERVISOR = ['caja.ver', 'caja.validar', 'caja.reportes'];

    private Caja $caja;
    private User $cajero;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
        $this->filaConId('almacenes', 2);

        $this->caja = Caja::create([
            'codigo' => 'PTS', 'nombre' => 'Caja Potosí', 'almacen_id' => 1, 'maneja_usd' => true,
            'formato_comprobante' => '{CAJA}-{AAAA}-{N:5}', 'reinicio_comprobante' => 'ANUAL',
        ]);
        $this->cajero = $this->usuario(self::CAJERO, true);
    }

    private function usuario(array $permisos, bool $cajeroDeLaCaja = false): User
    {
        $u = User::factory()->create();
        $u->givePermissionTo($permisos);
        $u->almacenes()->sync([1]);
        if ($cajeroDeLaCaja) {
            DB::table('caja.caja_cajero')->insert(['caja_id' => $this->caja->id, 'user_id' => $u->id]);
        }

        return $u;
    }

    private function como(User $u): void
    {
        Sanctum::actingAs($u->fresh());
    }

    /** Abre con 1.000 Bs y 50 US$, registra un ingreso de 500 y un egreso de 120,50. */
    private function diaConMovimientos(): int
    {
        $this->como($this->cajero);
        $sesion = $this->postJson("/api/caja/cajas/{$this->caja->id}/sesiones", ['saldo_inicial' => ['BOB' => 1000, 'USD' => 50]])
            ->assertCreated()->json('data.id');
        foreach ([['REPOSICION_FONDOS', 500], ['COMBUSTIBLE', 120.50]] as [$concepto, $monto]) {
            $this->postJson("/api/caja/sesiones/{$sesion}/movimientos", [
                'concepto_id' => Concepto::where('codigo', $concepto)->value('id'), 'monto' => $monto, 'moneda' => 'BOB',
                'forma_pago' => 'EFECTIVO', 'persona_nombre' => 'Juan Pérez', 'glosa' => 'Movimiento del día',
            ])->assertCreated();
        }

        return $sesion;     // esperado: 1.379,50 Bs y 50 US$
    }

    private function cerrar(int $sesion, array $monedas, ?string $observaciones = null): \Illuminate\Testing\TestResponse
    {
        return $this->postJson("/api/caja/sesiones/{$sesion}/cerrar", ['monedas' => $monedas, 'observaciones' => $observaciones]);
    }

    // ------------------------------------------------------------ Cierre

    public function test_cierre_con_arqueo_que_cuadra_y_la_siguiente_apertura_arranca_con_lo_contado(): void
    {
        $sesion = $this->diaConMovimientos();

        $this->cerrar($sesion, [
            'BOB' => ['arqueo' => [
                ['denominacion' => 200, 'cantidad' => 6], ['denominacion' => 100, 'cantidad' => 1],
                ['denominacion' => 50, 'cantidad' => 1], ['denominacion' => 20, 'cantidad' => 1],
                ['denominacion' => 5, 'cantidad' => 1], ['denominacion' => 2, 'cantidad' => 2],
                ['denominacion' => 0.5, 'cantidad' => 1], ['denominacion' => 10, 'cantidad' => 0],
            ]],
            'USD' => ['contado' => 50],
        ])->assertOk()->assertJsonPath('data.estado', 'CERRADA')
          ->assertJsonPath('data.saldos.0.saldo_esperado', '1379.50')
          ->assertJsonPath('data.saldos.0.saldo_contado', '1379.50')
          ->assertJsonPath('data.saldos.0.diferencia', '0.00');

        $this->assertSame(7, DB::table('caja.arqueo')->where('sesion_id', $sesion)->count(), 'Los cortes en cero no se guardan.');

        $this->getJson("/api/caja/cajas/{$this->caja->id}")->assertOk()
            ->assertJsonPath('data.saldos_arranque.BOB', '1379.50')
            ->assertJsonPath('data.saldos_arranque.USD', '50.00');
    }

    public function test_un_faltante_exige_explicacion(): void
    {
        $sesion = $this->diaConMovimientos();
        $monedas = ['BOB' => ['contado' => 1359.50], 'USD' => ['contado' => 50]];

        $this->cerrar($sesion, $monedas)->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'explique la diferencia'));
        $this->assertSame('ABIERTA', DB::table('caja.sesion')->where('id', $sesion)->value('estado'));

        $this->cerrar($sesion, $monedas, 'Faltan 20 Bs: vuelto mal entregado')->assertOk()
            ->assertJsonPath('data.saldos.0.diferencia', '-20.00');
    }

    public function test_cada_moneda_se_cuenta(): void
    {
        $sesion = $this->diaConMovimientos();

        $this->cerrar($sesion, ['BOB' => ['contado' => 1379.50]])
            ->assertStatus(422)->assertJsonValidationErrors('monedas.USD.contado');
        $this->cerrar($sesion, ['BOB' => ['contado' => 1379.50], 'USD' => ['contado' => null]])
            ->assertStatus(422)->assertJsonValidationErrors('monedas.USD.contado');
    }

    public function test_solo_un_cajero_de_la_caja_la_cierra(): void
    {
        $sesion = $this->diaConMovimientos();

        $this->como($this->usuario(self::CAJERO));       // mismos permisos, sin asignar
        $this->cerrar($sesion, ['BOB' => ['contado' => 1379.50], 'USD' => ['contado' => 50]])->assertForbidden();

        $this->como($this->usuario(['caja.ver', 'caja.abrir', 'caja.registrar'], true));   // asignado, sin caja.cerrar
        $this->cerrar($sesion, ['BOB' => ['contado' => 1379.50], 'USD' => ['contado' => 50]])->assertForbidden();
    }

    public function test_la_caja_se_cierra_a_diario(): void
    {
        // Una sesión que quedó abierta desde ayer.
        Transaccion::como($this->cajero->id, function () {
            $id = DB::table('caja.sesion')->insertGetId([
                'caja_id' => $this->caja->id, 'abierta_por' => $this->cajero->id, 'abierta_en' => now()->subDay(), 'numero' => 0,
            ]);
            DB::table('caja.sesion_saldo')->insert([['sesion_id' => $id, 'moneda' => 'BOB', 'saldo_inicial' => 300], ['sesion_id' => $id, 'moneda' => 'USD', 'saldo_inicial' => 0]]);
        });
        $sesion = DB::table('caja.sesion')->value('id');

        $this->como($this->cajero);
        $this->postJson("/api/caja/sesiones/{$sesion}/movimientos", [
            'concepto_id' => Concepto::where('codigo', 'COMBUSTIBLE')->value('id'), 'monto' => 10, 'moneda' => 'BOB',
            'forma_pago' => 'EFECTIVO', 'persona_nombre' => 'Juan Pérez', 'glosa' => 'Movimiento de hoy',
        ])->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'la caja se cierra a diario'));

        // Lo que sí se puede: cerrarla.
        $this->cerrar($sesion, ['BOB' => ['contado' => 300], 'USD' => ['contado' => 0]])->assertOk();
    }

    // -------------------------------------------------------- Validación

    public function test_un_supervisor_valida_y_quien_cerro_no_puede(): void
    {
        $sesion = $this->diaConMovimientos();
        $this->cerrar($sesion, ['BOB' => ['contado' => 1379.50], 'USD' => ['contado' => 50]])->assertOk();

        // Aunque tenga el permiso, quien cerró no valida su propio cierre.
        $this->cajero->givePermissionTo('caja.validar');
        $this->como($this->cajero);
        $this->postJson("/api/caja/sesiones/{$sesion}/validar")->assertStatus(422)
            ->assertJsonPath('message', 'Quien cerró la caja no puede validar su propio cierre.');

        $this->como($this->usuario(['caja.ver']));
        $this->postJson("/api/caja/sesiones/{$sesion}/validar")->assertForbidden();

        $supervisor = $this->usuario(self::SUPERVISOR);
        $this->como($supervisor);
        $this->getJson('/api/caja/sesiones?estado=CERRADA')->assertOk()->assertJsonPath('data.0.id', $sesion);
        $this->postJson("/api/caja/sesiones/{$sesion}/validar")->assertOk()->assertJsonPath('data.estado', 'VALIDADA');
        $this->assertSame($supervisor->id, DB::table('caja.sesion')->where('id', $sesion)->value('validada_por'));
    }

    public function test_no_se_valida_una_caja_abierta(): void
    {
        $sesion = $this->diaConMovimientos();
        $this->como($this->usuario(self::SUPERVISOR));
        $this->postJson("/api/caja/sesiones/{$sesion}/validar")->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'ABIERTA → VALIDADA'));
    }

    // ----------------------------------------------------------- Reportes

    public function test_reporte_diario_preliminar_y_de_cierre(): void
    {
        $sesion = $this->diaConMovimientos();

        $abierta = $this->get("/api/caja/sesiones/{$sesion}/reporte")->assertOk();
        $this->assertSame('application/pdf', $abierta->headers->get('Content-Type'));

        $this->cerrar($sesion, ['BOB' => ['arqueo' => [['denominacion' => 200, 'cantidad' => 7]]], 'USD' => ['contado' => 50]],
            'Sobran 20,50 Bs: se devolverán al cliente')->assertOk();
        $cerrada = $this->get("/api/caja/sesiones/{$sesion}/reporte")->assertOk();
        $this->assertStringStartsWith('%PDF', $cerrada->getContent());

        $this->getJson("/api/caja/sesiones/{$sesion}")->assertOk()
            ->assertJsonCount(1, 'data.arqueo')
            ->assertJsonPath('data.por_concepto.0.concepto_codigo', 'REPOSICION_FONDOS');
    }

    public function test_libro_de_caja_por_rango_y_concepto(): void
    {
        $this->diaConMovimientos();
        $hoy = now()->toDateString();

        // Otra caja de otra sede: el supervisor de la sede 1 no la ve.
        $otra = Caja::create(['codigo' => 'PRC', 'nombre' => 'Porco', 'almacen_id' => 2,
            'formato_comprobante' => '{CAJA}-{AAAA}-{N:5}', 'reinicio_comprobante' => 'ANUAL']);
        $ajeno = $this->usuario(self::CAJERO);
        DB::table('caja.caja_cajero')->insert(['caja_id' => $otra->id, 'user_id' => $ajeno->id]);
        $this->como($ajeno);
        $s2 = $this->postJson("/api/caja/cajas/{$otra->id}/sesiones", ['saldo_inicial' => ['BOB' => 900]])->json('data.id');
        $this->postJson("/api/caja/sesiones/{$s2}/movimientos", [
            'concepto_id' => Concepto::where('codigo', 'COMBUSTIBLE')->value('id'), 'monto' => 99, 'moneda' => 'BOB',
            'forma_pago' => 'EFECTIVO', 'persona_nombre' => 'Otro', 'glosa' => 'De otra sede',
        ])->assertCreated();

        $this->como($this->usuario(['caja.ver']));
        $this->getJson("/api/caja/libro?desde={$hoy}&hasta={$hoy}")->assertForbidden();

        $this->como($this->usuario(self::SUPERVISOR));
        $this->getJson("/api/caja/libro?desde={$hoy}&hasta={$hoy}")->assertOk()
            ->assertJsonPath('data.totales.movimientos', 2)
            ->assertJsonPath('data.totales.ingresos_efectivo', 500)
            ->assertJsonPath('data.totales.egresos_efectivo', 120.5)
            ->assertJsonPath('data.totales.neto_efectivo', 379.5);

        $combustible = Concepto::where('codigo', 'COMBUSTIBLE')->value('id');
        $this->getJson("/api/caja/libro?desde={$hoy}&hasta={$hoy}&concepto_id={$combustible}")->assertOk()
            ->assertJsonCount(1, 'data.movimientos')
            ->assertJsonPath('data.titulo', fn ($t) => str_contains($t, 'Compra de combustible'));

        $this->getJson('/api/caja/libro?desde=2026-01-01&hasta=2027-06-01')->assertStatus(422)->assertJsonValidationErrors('hasta');

        $excel = $this->get("/api/caja/libro/excel?desde={$hoy}&hasta={$hoy}")->assertOk();
        $this->assertStringContainsString('spreadsheetml', $excel->headers->get('Content-Type'));
        $pdf = $this->get("/api/caja/libro/pdf?desde={$hoy}&hasta={$hoy}")->assertOk();
        $this->assertSame('application/pdf', $pdf->headers->get('Content-Type'));
    }
}
