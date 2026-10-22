<?php

namespace Tests\Feature\Caja;

use App\Models\User;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Concepto;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\Feature\Cargas\PreparaBaseCargas;
use Tests\TestCase;

/**
 * Comprobantes provisionales: se entrega dinero a rendir en el día, el monto
 * se ajusta (sube o baja) con la caja abierta y se valida antes del cierre.
 */
class ComprobanteProvisionalApiTest extends TestCase
{
    use PreparaBaseCargas;
    use RefreshDatabase;

    private const CAJERO = ['caja.ver', 'caja.abrir', 'caja.registrar', 'caja.anular', 'caja.cerrar'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
    }

    // ------------------------------------------------------------- Ayudas

    private function usuario(array $permisos, array $cajeroDe = [], array $aprobadorDe = []): User
    {
        $usuario = User::factory()->create();
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

    private function caja(bool $aprobacion = false): Caja
    {
        return Caja::create([
            'codigo' => 'PTS', 'nombre' => 'Caja PTS', 'almacen_id' => 1, 'maneja_usd' => false,
            'formato_comprobante' => '{CAJA}-{N:5}', 'reinicio_comprobante' => 'NUNCA', 'requiere_aprobacion' => $aprobacion,
        ]);
    }

    private function concepto(string $codigo): int
    {
        return Concepto::where('codigo', $codigo)->value('id');
    }

    private function abrir(Caja $caja, float $saldo = 20000): int
    {
        return $this->postJson("/api/caja/cajas/{$caja->id}/sesiones", ['saldo_inicial' => ['BOB' => $saldo]])
            ->assertCreated()->json('data.id');
    }

    private function egreso(int $sesion, float $monto, array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson("/api/caja/sesiones/{$sesion}/movimientos", [
            'concepto_id' => $this->concepto('GASTOS_MENORES'), 'monto' => $monto, 'moneda' => 'BOB', 'forma_pago' => 'EFECTIVO',
            'persona_nombre' => 'juan pérez', 'glosa' => 'Compra de repuesto para la volqueta', 'provisional' => true, ...$extra,
        ]);
    }

    private function saldo(int $sesion): float
    {
        return (float) DB::selectOne("select caja.saldo_efectivo(?, 'BOB') as s", [$sesion])->s;
    }

    // -------------------------------------------------------------- Pruebas

    public function test_sin_aprobacion_el_ajuste_se_aplica_al_momento_y_se_valida(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO, [$caja]));
        $sesion = $this->abrir($caja);

        $mov = $this->egreso($sesion, 10000)->assertCreated()->assertJsonPath('data.provisional', true)->json('data');
        $this->assertSame(10000.0, $this->saldo($sesion));

        // Costó más: la caja entrega la diferencia.
        $this->postJson("/api/caja/movimientos/{$mov['id']}/ajustes", ['monto' => 15000, 'motivo' => 'El repuesto costó más', 'documento' => 'F-1234'])
            ->assertOk()->assertJsonPath('data.monto', '15000.00')->assertJsonPath('ajuste.estado', 'APLICADO')
            ->assertJsonPath('mensaje', fn ($m) => str_contains($m, 'entregue Bs 5.000,00 más'));
        $this->assertSame(5000.0, $this->saldo($sesion));

        // Luego baja: devuelven 3.000.
        $this->postJson("/api/caja/movimientos/{$mov['id']}/ajustes", ['monto' => 12000, 'motivo' => 'Descuento del proveedor'])
            ->assertOk()->assertJsonPath('mensaje', fn ($m) => str_contains($m, 'reciba Bs 3.000,00'));
        $this->assertSame(8000.0, $this->saldo($sesion));
        $this->assertSame(2, DB::table('caja.movimiento_ajuste')->where('movimiento_id', $mov['id'])->where('estado', 'APLICADO')->count());

        // Validado ya no se ajusta.
        $this->postJson("/api/caja/movimientos/{$mov['id']}/validar")->assertOk()->assertJsonPath('data.validado_por.id', fn ($v) => $v !== null);
        $this->postJson("/api/caja/movimientos/{$mov['id']}/ajustes", ['monto' => 11000, 'motivo' => 'Otro cambio más'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'ya está validado'));

        // El comprobante muestra el historial.
        $this->get("/api/caja/movimientos/{$mov['id']}/comprobante")->assertOk();
    }

    public function test_con_aprobacion_el_aumento_espera_al_aprobador_y_la_baja_no(): void
    {
        $caja = $this->caja(true);
        $cajera = $this->usuario(self::CAJERO, [$caja]);
        $cajeraAprobadora = $this->usuario([...self::CAJERO, 'caja.aprobar'], [$caja], [$caja]);
        $aprobador = $this->usuario(['caja.aprobar'], aprobadorDe: [$caja]);

        // Solicitud de 10.000 aprobada y pagada como provisional.
        $this->como($this->usuario(['caja.solicitar']));
        $sol = $this->postJson('/api/caja/solicitudes', ['caja_id' => $caja->id, 'concepto_id' => $this->concepto('GASTOS_MENORES'),
            'monto' => 10000, 'moneda' => 'BOB', 'glosa' => 'Repuesto para la volqueta'])->json('data.id');
        $this->como($aprobador);
        $this->postJson("/api/caja/solicitudes/{$sol}/aprobar")->assertOk();
        $this->como($cajera);
        $sesion = $this->abrir($caja);
        $mov = $this->postJson("/api/caja/solicitudes/{$sol}/pagar", ['forma_pago' => 'EFECTIVO', 'provisional' => true])
            ->assertCreated()->json('data.id');

        // Sube a 15.000: queda pendiente, el saldo no se mueve y no se valida.
        $ajuste = $this->postJson("/api/caja/movimientos/{$mov}/ajustes", ['monto' => 15000, 'motivo' => 'El repuesto costó más', 'documento' => 'F-77'])
            ->assertOk()->assertJsonPath('ajuste.estado', 'PENDIENTE')->json('ajuste.id');
        $this->assertSame(10000.0, $this->saldo($sesion));
        $this->postJson("/api/caja/movimientos/{$mov}/validar")->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'ajuste en curso'));
        $this->postJson("/api/caja/ajustes/{$ajuste}/aplicar")->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'espera la aprobación'));

        // Aparece en la bandeja; quien registró el comprobante no lo aprueba.
        $this->como($aprobador);
        $this->getJson('/api/caja/solicitudes/por-aprobar')->assertOk()->assertJsonCount(1, 'ajustes');

        // La cajera-aprobadora lo aprueba, pero entonces no lo puede entregar.
        $this->como($cajeraAprobadora);
        $this->postJson("/api/caja/ajustes/{$ajuste}/aprobar", ['observacion' => 'Factura conforme'])->assertOk();
        $this->postJson("/api/caja/ajustes/{$ajuste}/aplicar")->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'debe entregarlo otro cajero'));

        $this->como($cajera);
        $this->postJson("/api/caja/ajustes/{$ajuste}/aplicar")->assertOk()->assertJsonPath('data.monto', '15000.00');
        $this->assertSame(5000.0, $this->saldo($sesion));

        // Bajar no pide aprobación.
        $this->postJson("/api/caja/movimientos/{$mov}/ajustes", ['monto' => 14500, 'motivo' => 'Sobró para el flete'])
            ->assertOk()->assertJsonPath('ajuste.estado', 'APLICADO');
        $this->postJson("/api/caja/movimientos/{$mov}/validar")->assertOk();
    }

    public function test_el_aprobador_no_aprueba_su_propio_ajuste_y_el_rechazo_pide_motivo(): void
    {
        $caja = $this->caja(true);
        $cajeraAprobadora = $this->usuario([...self::CAJERO, 'caja.aprobar'], [$caja], [$caja]);
        $aprobador = $this->usuario(['caja.aprobar'], aprobadorDe: [$caja]);
        $this->como($cajeraAprobadora);
        $sesion = $this->abrir($caja);
        $mov = $this->egreso($sesion, 100, ['concepto_id' => $this->concepto('DEPOSITO_BANCARIO')])->assertCreated()->json('data.id');

        // Depósito es exento: sube sin aprobación.
        $this->postJson("/api/caja/movimientos/{$mov}/ajustes", ['monto' => 150, 'motivo' => 'Se depositó más'])
            ->assertOk()->assertJsonPath('ajuste.estado', 'APLICADO');

        // Un concepto no exento en caja con aprobación: lo registra ella, no lo aprueba ella.
        DB::table('caja.concepto')->where('codigo', 'GASTOS_MENORES')->update(['exento_aprobacion' => true]);
        $mov2 = $this->egreso($sesion, 100)->assertCreated()->json('data.id');
        DB::table('caja.concepto')->where('codigo', 'GASTOS_MENORES')->update(['exento_aprobacion' => false]);
        $ajuste = $this->postJson("/api/caja/movimientos/{$mov2}/ajustes", ['monto' => 200, 'motivo' => 'Costó el doble'])
            ->assertOk()->assertJsonPath('ajuste.estado', 'PENDIENTE')->json('ajuste.id');
        $this->postJson("/api/caja/ajustes/{$ajuste}/aprobar")->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'debe aprobarlo otro aprobador'));

        $this->como($aprobador);
        $this->postJson("/api/caja/ajustes/{$ajuste}/rechazar", [])->assertStatus(422)->assertJsonValidationErrors('observacion');
        $this->postJson("/api/caja/ajustes/{$ajuste}/rechazar", ['observacion' => 'No presentó factura'])->assertOk()
            ->assertJsonPath('data.estado', 'RECHAZADO');

        // Rechazado, el comprobante se valida con el monto original.
        $this->como($cajeraAprobadora);
        $this->postJson("/api/caja/movimientos/{$mov2}/validar")->assertOk()->assertJsonPath('data.monto', '100.00');
    }

    public function test_reglas_y_cierre(): void
    {
        $caja = $this->caja();
        $this->como($this->usuario(self::CAJERO, [$caja]));
        $sesion = $this->abrir($caja, 5000);

        // Solo egresos en efectivo.
        $banco = DB::table('comun.banco')->value('id') ?? DB::table('comun.banco')->insertGetId(['nombre' => 'Banco de prueba']);
        $this->egreso($sesion, 100, ['forma_pago' => 'CHEQUE', 'banco_id' => $banco, 'nro_documento' => '123'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'Solo los egresos en efectivo'));
        $this->postJson("/api/caja/sesiones/{$sesion}/movimientos", [
            'concepto_id' => $this->concepto('OTROS_INGRESOS'), 'monto' => 50, 'moneda' => 'BOB', 'forma_pago' => 'EFECTIVO',
            'persona_nombre' => 'juan', 'glosa' => 'Ingreso de prueba', 'provisional' => true,
        ])->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'Solo los egresos manuales'));

        // Uno definitivo no se ajusta.
        $definitivo = $this->egreso($sesion, 100, ['provisional' => false])->json('data.id');
        $this->postJson("/api/caja/movimientos/{$definitivo}/ajustes", ['monto' => 150, 'motivo' => 'Intento de ajuste'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'no es provisional'));

        // El monto no se cambia por fuera de las funciones.
        $prov = $this->egreso($sesion, 1000)->json('data.id');
        try {
            Transaccion::como(1, fn () => DB::table('caja.movimiento')->where('id', $prov)->update(['monto' => 1])) ;
            $this->fail('Se cambió el monto directo.');
        } catch (QueryException $e) {
            $this->assertStringContainsString('no se corrige', $e->getMessage());
        }

        // Más de lo que hay en caja: no.
        $this->postJson("/api/caja/movimientos/{$prov}/ajustes", ['monto' => 99000, 'motivo' => 'Monto imposible'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'Saldo insuficiente'));

        // No se cierra con provisionales sin validar.
        $this->postJson("/api/caja/sesiones/{$sesion}/cerrar", ['monedas' => ['BOB' => ['contado' => 3900]], 'observaciones' => 'Cierre'])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'provisionales sin validar'));

        // Anular el provisional también vale: deja de contar y ya no bloquea el cierre.
        $this->postJson("/api/caja/movimientos/{$prov}/anular", ['motivo' => 'No se compró el repuesto'])->assertOk();
        $this->postJson("/api/caja/sesiones/{$sesion}/cerrar", ['monedas' => ['BOB' => ['contado' => 4900]], 'observaciones' => 'Cierre'])
            ->assertOk();
    }
}
