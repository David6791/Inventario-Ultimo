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

    private const CAJERO = ['caja.ver', 'caja.abrir', 'caja.registrar', 'caja.anular', 'caja.cerrar'];

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

        $nueva = fn ($codigo, $almacen, $extra = []) => Caja::create(['codigo' => $codigo, 'nombre' => "Caja {$codigo}", 'almacen_id' => $almacen,
            'formato_comprobante' => '{CAJA}-{AAAA}-{N:5}', 'reinicio_comprobante' => 'ANUAL', ...$extra]);
        $this->central = $nueva('CING', 1, ['es_principal' => true]);
        $this->acopio = $nueva('MCJ', 2, ['devuelve_al_cerrar' => true]);
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
        $this->getJson("/api/caja/cajas/{$this->central->id}")->assertOk()->assertJsonPath('data.es_principal', true);

        $envio = $this->postJson("/api/caja/cajas/{$this->central->id}/envios", ['caja_destino_id' => $this->acopio->id,
            'monto' => 1500, 'moneda' => 'BOB', 'motivo' => 'Apertura de la semana', 'entregado_a' => 'juan quispe'])
            ->assertCreated()->assertJsonPath('data.estado', 'EN_TRANSITO')->json('data');
        $this->reglasDiferidas();
        $this->assertSame(3500.0, $this->saldo($sCentral));
        $this->assertStringStartsWith('ENT-', $envio['numero']);

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

    public function test_solo_la_caja_principal_entrega(): void
    {
        $this->abrir($this->cajeroAcopio, $this->acopio, 800);
        $this->getJson("/api/caja/cajas/{$this->acopio->id}/envios")->assertOk()->assertJsonPath('destinos', []);
        $this->postJson("/api/caja/cajas/{$this->acopio->id}/envios", ['caja_destino_id' => $this->central->id,
            'monto' => 100, 'moneda' => 'BOB', 'motivo' => 'Devolver sobrante'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'no es la caja principal'));
    }

    private function cerrar(int $sesion, float $contado, array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson("/api/caja/sesiones/{$sesion}/cerrar", ['monedas' => ['BOB' => ['contado' => $contado]], ...$extra]);
    }

    public function test_al_cerrar_devuelve_todo_a_la_principal_y_abre_en_cero(): void
    {
        $sCentral = $this->abrir($this->cajeroCentral, $this->central, 5000);
        $ent = $this->postJson("/api/caja/cajas/{$this->central->id}/envios", ['caja_destino_id' => $this->acopio->id,
            'monto' => 1000, 'moneda' => 'BOB', 'motivo' => 'Entrega del día'])->assertCreated()->json('data.id');
        $this->reglasDiferidas();

        $sAcopio = $this->abrir($this->cajeroAcopio, $this->acopio, 0);
        $this->postJson("/api/caja/envios/{$ent}/recibir")->assertOk();
        $this->reglasDiferidas();

        // Cierra con 20 de faltante: devuelve lo contado (980) y la diferencia queda en su arqueo.
        $this->cerrar($sAcopio, 980)->assertJsonPath('message', fn ($m) => str_contains($m, 'explique la diferencia'));
        $r = $this->cerrar($sAcopio, 980, ['observaciones' => 'Faltan 20 Bs, se revisa mañana', 'entregado_a' => 'juan quispe'])->assertOk();
        $this->reglasDiferidas();
        $this->assertStringContainsString('Devolución DEV-', $r->json('mensaje'));
        $saldo = DB::table('caja.sesion_saldo')->where('sesion_id', $sAcopio)->first();
        $this->assertSame([980.0, 980.0, -20.0], [(float) $saldo->saldo_contado, (float) $saldo->devuelto, (float) $saldo->diferencia]);
        $dev = DB::table('caja.envio_fondos')->where('tipo', 'DEVOLUCION')->first();
        $this->assertSame(['EN_TRANSITO', 980.0, $this->central->id, 'JUAN QUISPE'], [$dev->estado, (float) $dev->monto, $dev->caja_destino_id, $dev->entregado_a]);

        // La devolución no se anula; la principal no entrega otra vez hasta recibirla.
        Sanctum::actingAs($this->cajeroCentral);
        $this->postJson("/api/caja/envios/{$dev->id}/anular", ['motivo' => 'No llegó todo'])->assertStatus(422);
        $this->postJson("/api/caja/cajas/{$this->central->id}/envios", ['caja_destino_id' => $this->acopio->id,
            'monto' => 500, 'moneda' => 'BOB', 'motivo' => 'Entrega del día siguiente'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'sin recibir'));
        $this->getJson('/api/caja/cajas')->assertOk();
        $this->postJson("/api/caja/envios/{$dev->id}/recibir")->assertOk()->assertJsonPath('data.estado', 'RECIBIDO');
        $this->reglasDiferidas();
        $this->assertSame(4980.0, $this->saldo($sCentral));
        $this->assertSame('RECEPCION_DEVOLUCION', DB::table('caja.movimiento as m')->join('caja.concepto as k', 'k.id', '=', 'm.concepto_id')
            ->where('m.id', DB::table('caja.envio_fondos')->where('id', $dev->id)->value('movimiento_recepcion_id'))->value('k.codigo'));

        // Al día siguiente el acopio abre en cero.
        $nueva = $this->abrir($this->cajeroAcopio, $this->acopio, 777);
        $this->assertSame(0.0, $this->saldo($nueva));
    }

    public function test_sin_efectivo_no_hay_devolucion_y_la_caja_que_no_devuelve_conserva_su_saldo(): void
    {
        $s = $this->abrir($this->cajeroAcopio, $this->acopio, 0);
        $this->cerrar($s, 0)->assertOk();
        $this->reglasDiferidas();
        $this->assertSame(0, DB::table('caja.envio_fondos')->count());

        $s = $this->abrir($this->cajeroCentral, $this->central, 300);
        $this->cerrar($s, 300)->assertOk();
        $this->reglasDiferidas();
        $this->assertSame(0.0, (float) DB::table('caja.sesion_saldo')->where('sesion_id', $s)->value('devuelto'));
        $this->assertSame(300.0, $this->saldo($this->abrir($this->cajeroCentral, $this->central, 0)));
    }

    public function test_caja_solo_de_cargas_y_cambios_con_la_caja_cerrada(): void
    {
        $admin = User::factory()->create();
        $admin->givePermissionTo(['caja.ver', 'caja.administrar']);
        $datos = fn (array $c) => ['codigo' => 'MCJ', 'nombre' => 'Caja MCJ', 'almacen_id' => 2, 'formato_comprobante' => '{CAJA}-{AAAA}-{N:5}',
            'reinicio_comprobante' => 'ANUAL', 'activa' => true, 'devuelve_al_cerrar' => true, ...$c];
        Sanctum::actingAs($admin);
        $this->putJson("/api/caja/cajas/{$this->acopio->id}", $datos(['pagos' => 'CARGAS']))->assertOk()->assertJsonPath('data.pagos', 'CARGAS');
        $this->putJson("/api/caja/cajas/{$this->acopio->id}", $datos(['es_principal' => true]))->assertStatus(422)
            ->assertJsonValidationErrors('es_principal');

        $s = $this->abrir($this->cajeroAcopio, $this->acopio, 0);
        $gasto = DB::table('caja.concepto')->where('origen', 'MANUAL')->where('tipo', 'INGRESO')->value('id')
            ?? DB::table('caja.concepto')->insertGetId(['codigo' => 'OTRO_ING', 'nombre' => 'Otro ingreso', 'tipo' => 'INGRESO', 'origen' => 'MANUAL']);
        $this->postJson("/api/caja/sesiones/{$s}/movimientos", ['concepto_id' => $gasto, 'monto' => 50, 'moneda' => 'BOB',
            'forma_pago' => 'EFECTIVO', 'persona_nombre' => 'Alguien', 'glosa' => 'Ingreso de prueba'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'solo paga bonos y anticipos'));

        Sanctum::actingAs($admin);
        $this->putJson("/api/caja/cajas/{$this->acopio->id}", $datos(['pagos' => 'TODO']))->assertStatus(422)
            ->assertJsonValidationErrors('pagos');
    }
}
