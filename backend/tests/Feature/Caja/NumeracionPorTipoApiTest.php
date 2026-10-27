<?php

namespace Tests\Feature\Caja;

use App\Models\User;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Concepto;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\Feature\Cargas\PreparaBaseCargas;
use Tests\TestCase;

/** Numeración separada: egresos desde 1 e ingresos desde 10000, cada uno con su correlativo. */
class NumeracionPorTipoApiTest extends TestCase
{
    use PreparaBaseCargas;
    use RefreshDatabase;

    private const CAJERO = ['caja.ver', 'caja.abrir', 'caja.registrar', 'caja.anular'];

    private User $admin;
    private User $cajero;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
        $this->admin = User::factory()->create();
        $this->admin->givePermissionTo(['caja.ver', 'caja.administrar']);
        $this->admin->almacenes()->sync([1]);
        $this->cajero = User::factory()->create();
        $this->cajero->givePermissionTo(self::CAJERO);
        $this->cajero->almacenes()->sync([1]);
    }

    private function datosCaja(array $extra = []): array
    {
        return ['codigo' => 'PTS', 'nombre' => 'Caja PTS', 'almacen_id' => 1, 'maneja_usd' => false,
                'formato_comprobante' => '{CAJA}-{AAAA}-{N:5}', 'reinicio_comprobante' => 'ANUAL', 'activa' => true, ...$extra];
    }

    private function abrir(int $caja): int
    {
        DB::table('caja.caja_cajero')->insertOrIgnore(['caja_id' => $caja, 'user_id' => $this->cajero->id]);
        Sanctum::actingAs($this->cajero->fresh());

        return $this->postJson("/api/caja/cajas/{$caja}/sesiones", ['saldo_inicial' => ['BOB' => 1000]])->assertCreated()->json('data.id');
    }

    private function movimiento(int $sesion, string $concepto): string
    {
        return $this->postJson("/api/caja/sesiones/{$sesion}/movimientos", [
            'concepto_id' => Concepto::where('codigo', $concepto)->value('id'), 'monto' => 10, 'moneda' => 'BOB',
            'forma_pago' => 'EFECTIVO', 'persona_nombre' => 'juan', 'glosa' => 'Movimiento de prueba',
        ])->assertCreated()->json('data.numero');
    }

    public function test_egresos_desde_1_e_ingresos_desde_10000_y_cada_anio_vuelven_a_su_inicio(): void
    {
        Sanctum::actingAs($this->admin);
        $id = $this->postJson('/api/caja/cajas', $this->datosCaja([
            'numeracion_separada' => true, 'inicio_egreso' => 1, 'inicio_ingreso' => 10000,
        ]))->assertCreated()->json('data.id');

        $this->getJson('/api/caja/cajas')->assertOk()
            ->assertJsonPath('data.0.proximo_numero', 'PTS-' . date('Y') . '-00001')
            ->assertJsonPath('data.0.proximo_numero_ingreso', 'PTS-' . date('Y') . '-10000');

        $sesion = $this->abrir($id);
        $anio = date('Y');
        $this->assertSame("PTS-{$anio}-10000", $this->movimiento($sesion, 'OTROS_INGRESOS'));
        $this->assertSame("PTS-{$anio}-00001", $this->movimiento($sesion, 'GASTOS_MENORES'));
        $this->assertSame("PTS-{$anio}-10001", $this->movimiento($sesion, 'OTROS_INGRESOS'));
        $this->assertSame("PTS-{$anio}-00002", $this->movimiento($sesion, 'GASTOS_MENORES'));

        // El año siguiente cada correlativo vuelve a su número de inicio.
        $siguiente = ((int) $anio + 1) . '-01-05';
        $this->assertSame('PTS-' . ((int) $anio + 1) . '-10000', DB::selectOne("select caja.siguiente_comprobante(?, 'INGRESO', ?::date) as n", [$id, $siguiente])->n);
        $this->assertSame('PTS-' . ((int) $anio + 1) . '-00001', DB::selectOne("select caja.siguiente_comprobante(?, 'EGRESO', ?::date) as n", [$id, $siguiente])->n);
        $this->assertSame('PTS-' . ((int) $anio + 1) . '-10001', DB::selectOne("select caja.siguiente_comprobante(?, 'INGRESO', ?::date) as n", [$id, $siguiente])->n);
    }

    public function test_una_caja_existente_pasa_a_numeracion_separada_y_los_egresos_siguen(): void
    {
        Sanctum::actingAs($this->admin);
        $id = $this->postJson('/api/caja/cajas', $this->datosCaja())->assertCreated()->json('data.id');
        $sesion = $this->abrir($id);
        $anio = date('Y');
        $this->movimiento($sesion, 'GASTOS_MENORES');
        $this->movimiento($sesion, 'OTROS_INGRESOS');
        $this->assertSame("PTS-{$anio}-00003", $this->movimiento($sesion, 'GASTOS_MENORES'));

        Sanctum::actingAs($this->admin->fresh());
        $this->putJson("/api/caja/cajas/{$id}", $this->datosCaja(['numeracion_separada' => true, 'inicio_ingreso' => 10000]))->assertOk();

        Sanctum::actingAs($this->cajero->fresh());
        $this->assertSame("PTS-{$anio}-00004", $this->movimiento($sesion, 'GASTOS_MENORES'));
        $this->assertSame("PTS-{$anio}-10000", $this->movimiento($sesion, 'OTROS_INGRESOS'));
    }

    public function test_formato_propio_para_ingresos_y_choque_de_rangos(): void
    {
        Sanctum::actingAs($this->admin);
        $id = $this->postJson('/api/caja/cajas', $this->datosCaja([
            'numeracion_separada' => true, 'inicio_ingreso' => 10000, 'formato_ingreso' => 'ING-{AAAA}-{N:5}',
        ]))->assertCreated()->json('data.id');

        // La vista previa muestra los dos.
        $this->postJson('/api/caja/cajas/vista-previa', [...$this->datosCaja(['numeracion_separada' => true,
            'formato_ingreso' => 'ING-{AAAA}-{N:5}', 'proximo_ingreso' => 10000]), 'caja_id' => $id, 'proximo_comprobante' => 1])
            ->assertOk()->assertJsonPath('data.numero', 'PTS-' . date('Y') . '-00001')
            ->assertJsonPath('data.ingreso.numero', 'ING-' . date('Y') . '-10000');

        $sesion = $this->abrir($id);
        $this->assertSame('ING-' . date('Y') . '-10000', $this->movimiento($sesion, 'OTROS_INGRESOS'));

        // Mismo formato para los dos: si los egresos alcanzan a los ingresos, se rechaza.
        Sanctum::actingAs($this->admin->fresh());
        $this->putJson("/api/caja/cajas/{$id}", $this->datosCaja(['numeracion_separada' => true, 'inicio_ingreso' => 10000,
            'formato_ingreso' => null, 'proximo_ingreso' => 20000]))->assertOk();

        Sanctum::actingAs($this->cajero->fresh());
        $this->assertSame('PTS-' . date('Y') . '-20000', $this->movimiento($sesion, 'OTROS_INGRESOS'));
        Sanctum::actingAs($this->admin->fresh());
        $this->putJson("/api/caja/cajas/{$id}", $this->datosCaja(['numeracion_separada' => true, 'inicio_ingreso' => 10000,
            'proximo_comprobante' => 20000]))->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'ya existe'));
    }
}
