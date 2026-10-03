<?php

namespace Tests\Feature\Activos;

use App\Models\User;
use App\Modules\Activos\Models\Clase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class CatalogosApiTest extends TestCase
{
    use RefreshDatabase;

    private const GUARD = 'sanctum';

    public function test_sin_autenticar_devuelve_401(): void
    {
        $this->getJson('/api/activos/clases')->assertUnauthorized();
    }

    public function test_sin_permiso_devuelve_403(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/activos/clases')->assertForbidden();
    }

    public function test_con_permiso_de_lectura_lista_las_clases_del_anexo(): void
    {
        $this->actuandoCon(['activos-config.ver']);

        $respuesta = $this->getJson('/api/activos/clases')->assertOk();

        // El DDL siembra las 25 clases del Anexo del Art. 22 del DS 24051.
        $this->assertCount(25, $respuesta->json('data'));
    }

    public function test_la_lectura_no_habilita_la_escritura(): void
    {
        $this->actuandoCon(['activos-config.ver']);

        $this->postJson('/api/activos/clases', [
            'codigo' => '50', 'nombre' => 'Prueba', 'deprecia' => false,
        ])->assertForbidden();
    }

    public function test_una_clase_que_no_deprecia_rechaza_la_vida_util(): void
    {
        $this->actuandoCon(['activos-config.ver', 'activos-config.administrar']);

        $this->postJson('/api/activos/clases', [
            'codigo'   => '50',
            'nombre'   => 'Terrenos urbanos',
            'deprecia' => false,
            'vida_util_fiscal_meses' => 480,
        ])->assertStatus(422)->assertJsonValidationErrors('vida_util_fiscal_meses');
    }

    public function test_una_clase_que_deprecia_exige_vida_util(): void
    {
        $this->actuandoCon(['activos-config.ver', 'activos-config.administrar']);

        $this->postJson('/api/activos/clases', [
            'codigo' => '51', 'nombre' => 'Equipos varios', 'deprecia' => true,
        ])->assertStatus(422)->assertJsonValidationErrors('vida_util_fiscal_meses');
    }

    public function test_eliminar_desactiva_en_lugar_de_borrar(): void
    {
        $this->actuandoCon(['activos-config.ver', 'activos-config.administrar']);

        $clase = Clase::where('codigo', '05')->firstOrFail();

        $this->deleteJson("/api/activos/clases/{$clase->id}")->assertOk();

        // Sigue en la tabla: los activos históricos y los períodos cerrados
        // la referencian.
        $this->assertDatabaseHas('activos.clase', ['id' => $clase->id, 'activo' => false]);
    }

    public function test_un_parametro_no_puede_cambiarse_con_vigencia_pasada(): void
    {
        $this->actuandoCon(['activos-config.ver', 'activos-config.administrar']);

        $this->putJson('/api/activos/parametros/UMBRAL_CAPITALIZACION_UFV', [
            'valor'         => '800',
            'vigente_desde' => now()->subDay()->toDateString(),
        ])->assertStatus(422)->assertJsonValidationErrors('vigente_desde');
    }

    /** @param list<string> $permisos */
    private function actuandoCon(array $permisos): User
    {
        $usuario = User::factory()->create();

        foreach ($permisos as $nombre) {
            Permission::findOrCreate($nombre, self::GUARD);
        }

        $usuario->givePermissionTo($permisos);

        Sanctum::actingAs($usuario);

        return $usuario;
    }
}
