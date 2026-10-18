<?php

namespace Tests\Feature\Cargas;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApiEstadoYErroresTest extends TestCase
{
    use PreparaBaseCargas;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
    }

    public function test_estado_muestra_esquemas_catalogo_y_proximos_codigos(): void
    {
        $usuario = User::findOrFail(1);
        $usuario->assignRole('Recepción de Cargas');
        Sanctum::actingAs($usuario);

        $respuesta = $this->getJson('/api/cargas/estado')->assertOk();

        $this->assertEqualsCanonicalizing(
            ['caja', 'cargas', 'comun'],
            collect($respuesta->json('esquemas'))->pluck('esquema')->all()
        );
        $this->assertSame(7, $respuesta->json('catalogo.series'));
        $this->assertMatchesRegularExpression(
            '/^CZP-\d{6}-0001$/',
            collect($respuesta->json('series'))->firstWhere('prefijo', 'CZP')['proximo_codigo']
        );
    }

    public function test_estado_exige_permiso(): void
    {
        Sanctum::actingAs(User::findOrFail(2));   // sin roles

        $this->getJson('/api/cargas/estado')->assertForbidden();
    }

    public function test_una_regla_de_la_base_llega_como_422_en_espanol(): void
    {
        Route::post('/api/_prueba/regla', function () {
            DB::insert("insert into cargas.productor (tipo, nombre) values ('PARTICULAR', 'Sin documento')");
        });

        $this->postJson('/api/_prueba/regla')
            ->assertStatus(422)
            ->assertJson([
                'message' => 'Indique el CI o el NIT del productor.',
                'codigo'  => 'ck_productor_identificacion',
                'tipo'    => 'regla_de_negocio',
            ]);
    }

    public function test_un_raise_de_trigger_llega_como_422_con_su_mensaje(): void
    {
        Route::post('/api/_prueba/raise', function () {
            DB::select("select comun.validar_formato('{PREFIJO}-{N:4}', 'MENSUAL', array['PREFIJO'])");
        });

        $this->postJson('/api/_prueba/raise')
            ->assertStatus(422)
            ->assertJsonPath('codigo', 'P0001')
            ->assertJsonPath('message', fn ($m) => str_starts_with($m, 'Con reinicio MENSUAL el formato debe mostrar el año y el mes'));
    }
}
