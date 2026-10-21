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

/**
 * Cajas con aprobación: solicitud → aprobación → pago por la cajera, con la
 * separación de funciones en la base. También el próximo comprobante.
 */
class SolicitudesCajaApiTest extends TestCase
{
    use PreparaBaseCargas;
    use RefreshDatabase;

    private const CAJERO = ['caja.ver', 'caja.abrir', 'caja.registrar', 'caja.anular'];
    private const ADMIN = ['caja.ver', 'caja.administrar'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
    }

    // ------------------------------------------------------------- Ayudas

    private function usuario(array $permisos, array $cajeroDe = [], array $aprobadorDe = [], ?string $ci = null): User
    {
        $usuario = User::factory()->create(['ci' => $ci]);
        $usuario->givePermissionTo($permisos);
        $usuario->almacenes()->sync([1]);
        foreach ($cajeroDe as $caja) {
            DB::table('caja.caja_cajero')->insert(['caja_id' => $caja->id, 'user_id' => $usuario->id]);
        }
        foreach ($aprobadorDe as $caja) {
            DB::table('caja.caja_aprobador')->insert(['caja_id' => $caja->id, 'user_id' => $usuario->id]);
        }

        return $usuario;
    }

    private function como(User $usuario): User
    {
        Sanctum::actingAs($usuario->fresh());

        return $usuario;
    }

    private function caja(bool $aprobacion = true, string $codigo = 'PTS'): Caja
    {
        return Caja::create([
            'codigo' => $codigo, 'nombre' => "Caja {$codigo}", 'almacen_id' => 1, 'maneja_usd' => false,
            'formato_comprobante' => '{CAJA}-{N:5}', 'reinicio_comprobante' => 'NUNCA',
            'requiere_aprobacion' => $aprobacion,
        ]);
    }

    private function concepto(string $codigo): int
    {
        return Concepto::where('codigo', $codigo)->value('id');
    }

    private function abrir(Caja $caja, User $cajero, float $saldo = 1000): int
    {
        $this->como($cajero);

        return $this->postJson("/api/caja/cajas/{$caja->id}/sesiones", ['saldo_inicial' => ['BOB' => $saldo]])
            ->assertCreated()->json('data.id');
    }

    private function solicitar(Caja $caja, float $monto = 150, array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/caja/solicitudes', [
            'caja_id' => $caja->id, 'concepto_id' => $this->concepto('COMBUSTIBLE'), 'monto' => $monto,
            'moneda' => 'BOB', 'glosa' => 'Combustible para la camioneta de muestreo', ...$extra,
        ]);
    }

    private function saldo(int $sesion): float
    {
        return (float) DB::selectOne("select caja.saldo_efectivo(?, 'BOB') as s", [$sesion])->s;
    }

    // ------------------------------------------------------- Comprobante

    public function test_la_caja_puede_seguir_la_numeracion_de_otro_sistema_y_no_volver_atras(): void
    {
        $admin = $this->como($this->usuario(self::ADMIN));

        $id = $this->postJson('/api/caja/cajas', [
            'codigo' => 'PTS', 'nombre' => 'Caja Potosí', 'almacen_id' => 1, 'maneja_usd' => false,
            'formato_comprobante' => '{CAJA}-{N:5}', 'reinicio_comprobante' => 'NUNCA',
            'requiere_aprobacion' => false, 'proximo_comprobante' => 1530, 'motivo_numeracion' => 'Continúa el sistema anterior',
        ])->assertCreated()->json('data.id');

        $caja = Caja::find($id);
        $this->assertSame(1529, (int) DB::selectOne('select caja.ultimo_comprobante(?) as n', [$id])->n);
        $this->assertDatabaseHas('caja.ajuste_numeracion', ['caja_id' => $id, 'anterior' => 1, 'proximo' => 1530, 'usuario_id' => $admin->id]);

        $cajero = $this->usuario(self::CAJERO, [$caja]);
        $sesion = $this->abrir($caja, $cajero);
        $numero = $this->postJson("/api/caja/sesiones/{$sesion}/movimientos", [
            'concepto_id' => $this->concepto('COMBUSTIBLE'), 'monto' => 10, 'moneda' => 'BOB', 'forma_pago' => 'EFECTIVO',
            'persona_nombre' => 'juan pérez', 'glosa' => 'Pago directo de prueba',
        ])->assertCreated()->json('data.numero');
        $this->assertSame('PTS-01530', $numero);

        $this->como($admin);
        $this->putJson("/api/caja/cajas/{$id}", [...$caja->fresh()->only(['codigo', 'nombre', 'almacen_id', 'maneja_usd',
            'formato_comprobante', 'reinicio_comprobante', 'activa', 'requiere_aprobacion']), 'proximo_comprobante' => 1500])
            ->assertStatus(422)
            ->assertJsonPath('errors.proximo_comprobante.0', fn ($m) => str_contains($m, 'se repetirían números'));

        $this->putJson("/api/caja/cajas/{$id}", [...$caja->fresh()->only(['codigo', 'nombre', 'almacen_id', 'maneja_usd',
            'formato_comprobante', 'reinicio_comprobante', 'activa', 'requiere_aprobacion']), 'proximo_comprobante' => 2000])
            ->assertOk();
        $this->assertSame(1999, (int) DB::selectOne('select caja.ultimo_comprobante(?) as n', [$id])->n);
    }

    // ---------------------------------------------------------- Flujo

    public function test_solicitud_aprobada_la_paga_la_cajera_y_si_anula_el_comprobante_vuelve_a_aprobada(): void
    {
        $caja = $this->caja();
        $cajera = $this->usuario(self::CAJERO, [$caja]);
        $aprobador = $this->usuario(['caja.aprobar'], aprobadorDe: [$caja]);
        $solicitante = $this->usuario(['caja.solicitar'], ci: '1234567');
        $sesion = $this->abrir($caja, $cajera);

        // La cajera no paga egresos manuales directo en esta caja.
        $this->postJson("/api/caja/sesiones/{$sesion}/movimientos", [
            'concepto_id' => $this->concepto('COMBUSTIBLE'), 'monto' => 50, 'moneda' => 'BOB', 'forma_pago' => 'EFECTIVO',
            'persona_nombre' => 'juan pérez', 'glosa' => 'Intento de pago directo',
        ])->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'requiere aprobación'));

        // El solicitante pide a su nombre.
        $this->como($solicitante);
        $sol = $this->solicitar($caja)->assertCreated()
            ->assertJsonPath('data.estado', 'PENDIENTE')
            ->assertJsonPath('data.persona_ci', '1234567')
            ->json('data');
        $this->getJson('/api/caja/solicitudes/mias')->assertOk()->assertJsonCount(1, 'data');

        // Pendiente: no se paga.
        $this->como($cajera);
        $this->postJson("/api/caja/solicitudes/{$sol['id']}/pagar", ['forma_pago' => 'EFECTIVO'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'solo se pagan las aprobadas'));

        // El aprobador la ve en su bandeja y la aprueba.
        $this->como($aprobador);
        $this->getJson('/api/caja/solicitudes/por-aprobar')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson("/api/caja/solicitudes/{$sol['id']}/aprobar", ['observacion' => 'Conforme'])
            ->assertOk()->assertJsonPath('data.estado', 'APROBADA');

        // La cajera la ve por pagar y la paga.
        $this->como($cajera);
        $this->getJson("/api/caja/cajas/{$caja->id}/solicitudes")->assertOk()->assertJsonCount(1, 'data');
        $mov = $this->postJson("/api/caja/solicitudes/{$sol['id']}/pagar", ['forma_pago' => 'EFECTIVO'])
            ->assertCreated()->json('data');
        $this->assertSame('150.00', $mov['monto']);
        $this->assertSame($sol['persona_id'], $mov['persona_id']);
        $this->assertSame(850.0, $this->saldo($sesion));
        $this->assertDatabaseHas('caja.solicitud', ['id' => $sol['id'], 'estado' => 'PAGADA', 'movimiento_id' => $mov['id']]);

        // No se paga dos veces.
        $this->postJson("/api/caja/solicitudes/{$sol['id']}/pagar", ['forma_pago' => 'EFECTIVO'])->assertStatus(422);

        // Comprobante anulado: la solicitud vuelve a aprobada y se paga de nuevo.
        $this->postJson("/api/caja/movimientos/{$mov['id']}/anular", ['motivo' => 'Se entregó a otra persona por error'])->assertOk();
        $this->assertDatabaseHas('caja.solicitud', ['id' => $sol['id'], 'estado' => 'APROBADA', 'movimiento_id' => null]);
        $this->assertSame(1000.0, $this->saldo($sesion));
        $this->postJson("/api/caja/solicitudes/{$sol['id']}/pagar", ['forma_pago' => 'EFECTIVO'])->assertCreated();
    }

    public function test_solo_aprueba_un_aprobador_de_la_caja_y_nunca_lo_suyo(): void
    {
        $caja = $this->caja();
        $otraCaja = $this->caja(true, 'PORCO');
        $cajera = $this->usuario([...self::CAJERO, 'caja.aprobar'], [$caja], [$caja], ci: '777');
        $deOtraCaja = $this->usuario(['caja.aprobar'], aprobadorDe: [$otraCaja]);

        // La cajera registra a nombre de una persona y no puede aprobar lo que registró.
        $this->como($cajera);
        $sol = $this->solicitar($caja, 80, ['persona_nombre' => 'maría quispe', 'persona_ci' => '555'])
            ->assertCreated()->assertJsonPath('data.persona_nombre', 'MARÍA QUISPE')->json('data');
        $this->postJson("/api/caja/solicitudes/{$sol['id']}/aprobar")
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'usted registró'));

        // Un aprobador de otra caja tampoco.
        $this->como($deOtraCaja);
        $this->postJson("/api/caja/solicitudes/{$sol['id']}/aprobar")
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'no es aprobador de la caja PTS'));

        // Una solicitud a nombre del propio aprobador (por su CI) tampoco.
        $otraCajera = $this->usuario(self::CAJERO, [$caja]);
        $this->como($otraCajera);
        $aSuNombre = $this->solicitar($caja, 40, ['persona_nombre' => 'la cajera', 'persona_ci' => '777'])->assertCreated()->json('data');
        $this->como($cajera);
        $this->postJson("/api/caja/solicitudes/{$aSuNombre['id']}/aprobar")
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'es a su nombre'));
    }

    public function test_quien_aprobo_no_paga_y_la_rechazada_no_se_paga(): void
    {
        $caja = $this->caja();
        $cajeraAprobadora = $this->usuario([...self::CAJERO, 'caja.aprobar'], [$caja], [$caja]);
        $solicitante = $this->usuario(['caja.solicitar']);
        $this->abrir($caja, $cajeraAprobadora);

        $this->como($solicitante);
        $a = $this->solicitar($caja, 100)->json('data.id');
        $b = $this->solicitar($caja, 200)->json('data.id');

        $this->como($cajeraAprobadora);
        $this->postJson("/api/caja/solicitudes/{$a}/aprobar")->assertOk();
        $this->postJson("/api/caja/solicitudes/{$a}/pagar", ['forma_pago' => 'EFECTIVO'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'debe pagarla otro cajero'));

        $this->postJson("/api/caja/solicitudes/{$b}/rechazar", [])->assertStatus(422)->assertJsonValidationErrors('observacion');
        $this->postJson("/api/caja/solicitudes/{$b}/rechazar", ['observacion' => 'No corresponde a este mes'])
            ->assertOk()->assertJsonPath('data.estado', 'RECHAZADA');
        $this->postJson("/api/caja/solicitudes/{$b}/pagar", ['forma_pago' => 'EFECTIVO'])->assertStatus(422);
    }

    public function test_reglas_de_alta_anulacion_y_conceptos_exentos(): void
    {
        $directa = $this->caja(false, 'DIR');
        $caja = $this->caja();
        $solicitante = $this->usuario(['caja.solicitar']);
        $otro = $this->usuario(['caja.solicitar']);
        $cajera = $this->usuario(self::CAJERO, [$caja]);

        $this->como($solicitante);
        // Caja que paga directo: no recibe solicitudes.
        $this->solicitar($directa)->assertStatus(422)->assertJsonValidationErrors('caja_id');
        // El solicitante no pide a nombre de otro.
        $this->solicitar($caja, 50, ['persona_nombre' => 'otra persona'])->assertStatus(422)->assertJsonValidationErrors('persona_nombre');
        // Ingresos no se solicitan.
        $this->solicitar($caja, 50, ['concepto_id' => $this->concepto('REPOSICION_FONDOS')])->assertStatus(422)->assertJsonValidationErrors('concepto_id');

        $id = $this->solicitar($caja)->assertCreated()->json('data.id');

        // Otro solicitante no la anula; quien la registró sí.
        $this->como($otro);
        $this->postJson("/api/caja/solicitudes/{$id}/anular", ['motivo' => 'No es mía pero intento anularla'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'la anula quien la registró'));
        $this->como($solicitante);
        $this->postJson("/api/caja/solicitudes/{$id}/anular", ['motivo' => 'Ya no necesito el dinero'])
            ->assertOk()->assertJsonPath('data.estado', 'ANULADA');

        // El depósito en banco es exento: la cajera lo registra directo.
        $sesion = $this->abrir($caja, $cajera);
        $this->postJson("/api/caja/sesiones/{$sesion}/movimientos", [
            'concepto_id' => $this->concepto('DEPOSITO_BANCARIO'), 'monto' => 300, 'moneda' => 'BOB', 'forma_pago' => 'EFECTIVO',
            'persona_nombre' => 'banco unión', 'glosa' => 'Depósito del día',
        ])->assertCreated();
    }

    public function test_no_se_quita_la_aprobacion_con_solicitudes_en_curso_y_se_asignan_aprobadores(): void
    {
        $caja = $this->caja();
        $admin = $this->usuario(self::ADMIN);
        $aprobador = $this->usuario(['caja.aprobar']);

        $this->como($admin);
        $this->putJson("/api/caja/cajas/{$caja->id}/aprobadores", ['usuarios' => [$aprobador->id]])
            ->assertOk()->assertJsonPath('data.0.id', $aprobador->id);
        $this->getJson('/api/caja/opciones')->assertOk()->assertJsonPath('data.aprobadores.0.id', $aprobador->id);

        $this->como($this->usuario(['caja.solicitar']));
        $this->solicitar($caja)->assertCreated();

        $this->como($admin);
        $this->putJson("/api/caja/cajas/{$caja->id}", [...$caja->only(['codigo', 'nombre', 'almacen_id', 'maneja_usd',
            'formato_comprobante', 'reinicio_comprobante']), 'activa' => true, 'requiere_aprobacion' => false])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'resuélvalas antes de quitar la aprobación'));
    }
}
