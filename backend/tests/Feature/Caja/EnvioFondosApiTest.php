<?php

namespace Tests\Feature\Caja;

use App\Models\User;
use App\Modules\Activos\Models\CentroCosto;
use App\Modules\Caja\Models\Caja;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\Feature\Cargas\PreparaBaseCargas;
use Tests\TestCase;

/** Envío de dinero de la caja de la sede central a la caja de un acopio, con recepción. */
class EnvioFondosApiTest extends TestCase
{
    use PreparaBaseCargas;
    use RefreshDatabase;

    private const CAJERO = ['caja.ver', 'caja.abrir', 'caja.registrar', 'caja.anular'];

    private Caja $central;
    private Caja $acopio;
    private User $cajeroCentral;
    private User $cajeroAcopio;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
        $this->filaConId('almacenes', 2);
        $area = DB::table('activos.area')->insertGetId(['codigo' => 'PRUEBA', 'nombre' => 'Prueba']);
        CentroCosto::create(['area_id' => $area, 'codigo' => 'ADM_POTOSI', 'nombre' => 'Administración Potosí', 'almacen_id' => 1, 'es_central' => true]);
        CentroCosto::create(['area_id' => $area, 'codigo' => 'ACOPIO_PORCO', 'nombre' => 'Acopio Porco', 'almacen_id' => 2, 'es_acopio' => true]);

        $nueva = fn ($codigo, $almacen) => Caja::create(['codigo' => $codigo, 'nombre' => "Caja {$codigo}", 'almacen_id' => $almacen,
            'formato_comprobante' => '{CAJA}-{AAAA}-{N:5}', 'reinicio_comprobante' => 'ANUAL']);
        $this->central = $nueva('CING', 1);
        $this->acopio = $nueva('MCJ', 2);
        $this->cajeroCentral = $this->cajero([1], $this->central);
        $this->cajeroAcopio = $this->cajero([2], $this->acopio);
    }

    private function cajero(array $almacenes, Caja $caja): User
    {
        $u = User::factory()->create();
        $u->givePermissionTo(self::CAJERO);
        $u->almacenes()->sync($almacenes);
        DB::table('caja.caja_cajero')->insert(['caja_id' => $caja->id, 'user_id' => $u->id]);

        return $u;
    }

    private function abrir(User $u, Caja $caja, float $saldo): int
    {
        Sanctum::actingAs($u);

        return $this->postJson("/api/caja/cajas/{$caja->id}/sesiones", ['saldo_inicial' => ['BOB' => $saldo]])->assertCreated()->json('data.id');
    }

    private function saldo(int $sesion): float
    {
        return (float) DB::selectOne("select caja.saldo_efectivo(?, 'BOB') as s", [$sesion])->s;
    }

    /** Las reglas diferidas corren al confirmar; la prueba nunca confirma. */
    private function reglasDiferidas(): void
    {
        DB::statement('SET CONSTRAINTS ALL IMMEDIATE');
        DB::statement('SET CONSTRAINTS ALL DEFERRED');
    }

    public function test_envio_en_transito_y_recepcion_en_el_acopio(): void
    {
        $sCentral = $this->abrir($this->cajeroCentral, $this->central, 5000);
        $destinos = $this->getJson("/api/caja/cajas/{$this->central->id}/envios")->assertOk()->json('destinos');
        $this->assertSame(['MCJ'], array_column($destinos, 'codigo'));
        $this->getJson("/api/caja/cajas/{$this->central->id}")->assertOk()->assertJsonPath('data.es_central', true);

        $envio = $this->postJson("/api/caja/cajas/{$this->central->id}/envios", ['caja_destino_id' => $this->acopio->id,
            'monto' => 1500, 'moneda' => 'BOB', 'motivo' => 'Apertura de la semana', 'entregado_a' => 'juan quispe'])
            ->assertCreated()->assertJsonPath('data.estado', 'EN_TRANSITO')->json('data');
        $this->reglasDiferidas();
        $this->assertSame(3500.0, $this->saldo($sCentral));
        $this->assertStringStartsWith('ENV-', $envio['numero']);

        // El acopio ve el envío por recibir; con la caja cerrada no puede recibirlo.
        Sanctum::actingAs($this->cajeroAcopio);
        $this->getJson('/api/caja/cajas')->assertOk()->assertJsonPath('data.0.envios_por_recibir', 1);
        $this->postJson("/api/caja/envios/{$envio['id']}/recibir")->assertStatus(422);
        // Ni el cajero de la central lo recibe por el acopio.
        Sanctum::actingAs($this->cajeroCentral);
        $this->postJson("/api/caja/envios/{$envio['id']}/recibir")->assertForbidden();

        $sAcopio = $this->abrir($this->cajeroAcopio, $this->acopio, 0);
        $this->postJson("/api/caja/envios/{$envio['id']}/recibir")->assertOk()
            ->assertJsonPath('data.estado', 'RECIBIDO')->assertJsonPath('data.recibido_por.id', $this->cajeroAcopio->id);
        $this->reglasDiferidas();
        $this->assertSame(1500.0, $this->saldo($sAcopio));
        $this->postJson("/api/caja/envios/{$envio['id']}/recibir")->assertStatus(422);

        // El comprobante del envío no se anula desde caja.
        $mov = DB::table('caja.envio_fondos')->where('id', $envio['id'])->value('movimiento_recepcion_id');
        $this->postJson("/api/caja/movimientos/{$mov}/anular", ['motivo' => 'Se recibió por error'])->assertStatus(422);
    }

    public function test_anular_un_envio_en_transito_devuelve_el_dinero(): void
    {
        $s = $this->abrir($this->cajeroCentral, $this->central, 1000);
        $id = $this->postJson("/api/caja/cajas/{$this->central->id}/envios", ['caja_destino_id' => $this->acopio->id,
            'monto' => 400, 'moneda' => 'BOB', 'motivo' => 'Reposición de fondos'])->assertCreated()->json('data.id');
        $this->postJson("/api/caja/envios/{$id}/anular", ['motivo' => 'Se envió a la caja equivocada'])->assertOk()
            ->assertJsonPath('data.estado', 'ANULADO');
        $this->reglasDiferidas();
        $this->assertSame(1000.0, $this->saldo($s));
        $this->postJson("/api/caja/envios/{$id}/anular", ['motivo' => 'Otra vez'])->assertStatus(422);

        // Más de lo que hay en caja: no sale.
        $this->postJson("/api/caja/cajas/{$this->central->id}/envios", ['caja_destino_id' => $this->acopio->id,
            'monto' => 5000, 'moneda' => 'BOB', 'motivo' => 'Envío grande'])->assertStatus(422);
    }

    public function test_solo_la_caja_de_la_sede_central_envia(): void
    {
        $this->abrir($this->cajeroAcopio, $this->acopio, 800);
        $this->getJson("/api/caja/cajas/{$this->acopio->id}/envios")->assertOk()->assertJsonPath('destinos', []);
        $this->postJson("/api/caja/cajas/{$this->acopio->id}/envios", ['caja_destino_id' => $this->central->id,
            'monto' => 100, 'moneda' => 'BOB', 'motivo' => 'Devolver sobrante'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'no es de la sede central'));
    }
}
