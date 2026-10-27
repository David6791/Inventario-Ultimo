<?php

namespace Tests\Feature\Cargas;

use App\Models\User;
use App\Modules\Cargas\Models\Productor;
use App\Modules\Cargas\Models\SerieLote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Sedes de recepción con recepcionistas asignados, como los cajeros de una caja. */
class SedesRecepcionApiTest extends TestCase
{
    use PreparaBaseCargas;
    use RefreshDatabase;

    private function usuario(array $permisos, array $almacenes = [1, 2]): User
    {
        $u = User::factory()->create();
        $u->givePermissionTo($permisos);
        $u->almacenes()->sync($almacenes);

        return $u;
    }

    private function recibir(int $sede): \Illuminate\Testing\TestResponse
    {
        $p = Productor::firstOrCreate(['nombre' => 'PRODUCTOR SEDES'], ['tipo' => 'PARTICULAR', 'ci' => '7000007']);

        return $this->postJson('/api/cargas/lotes', ['serie_id' => SerieLote::where('prefijo', 'CZP')->value('id'),
            'almacen_id' => $sede, 'productor_id' => $p->id]);
    }

    public function test_recepcionistas_por_sede(): void
    {
        $this->prepararBaseCargas();
        $this->filaConId('almacenes', 2);
        $ana = $this->usuario(['cargas.ver', 'cargas.recibir']);
        $beto = $this->usuario(['cargas.ver', 'cargas.recibir']);
        $admin = $this->usuario(['cargas.ver', 'cargas.catalogos']);

        // Solo quien administra catálogos asigna recepcionistas.
        Sanctum::actingAs($ana);
        $this->putJson('/api/cargas/sedes-recepcion/2', ['usuarios' => [$ana->id]])->assertForbidden();

        Sanctum::actingAs($admin);
        $this->getJson('/api/cargas/sedes-recepcion')->assertOk()
            ->assertJsonPath('candidatos', fn ($c) => in_array($ana->id, array_column($c, 'id')));
        $this->putJson('/api/cargas/sedes-recepcion/2', ['usuarios' => [$ana->id]])->assertOk()
            ->assertJsonPath('data.recepcionistas.0.id', $ana->id);

        // Ana recibe solo en su sede, y el formulario no la pide.
        Sanctum::actingAs($ana->fresh());
        $this->getJson('/api/cargas/opciones')->assertOk()
            ->assertJsonPath('data.sede_recepcion_fija', 2)
            ->assertJsonPath('data.sedes_recepcion.0.id', 2)
            ->assertJsonCount(1, 'data.sedes_recepcion');
        $this->recibir(1)->assertStatus(422)->assertJsonValidationErrors('almacen_id');
        $this->recibir(2)->assertCreated();

        // Beto no tiene sede asignada: usa las suyas que no tienen recepcionistas.
        Sanctum::actingAs($beto->fresh());
        $this->getJson('/api/cargas/opciones')->assertJsonPath('data.sede_recepcion_fija', null)
            ->assertJsonCount(1, 'data.sedes_recepcion')->assertJsonPath('data.sedes_recepcion.0.id', 1);
        $this->recibir(2)->assertStatus(422);
        $this->recibir(1)->assertCreated();

        // Quitar los recepcionistas libera la sede.
        Sanctum::actingAs($admin->fresh());
        $this->putJson('/api/cargas/sedes-recepcion/2', ['usuarios' => []])->assertOk();
        Sanctum::actingAs($beto->fresh());
        $this->recibir(2)->assertCreated();
    }
}
