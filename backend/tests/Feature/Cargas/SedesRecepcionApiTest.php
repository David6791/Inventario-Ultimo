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

    // ------------------------------------------------------------- Centros de costo

    private function centro(string $codigo, ?int $almacen, array $extra = []): int
    {
        $area = \Illuminate\Support\Facades\DB::table('activos.area')->where('codigo', 'PRUEBA')->value('id')
            ?? \Illuminate\Support\Facades\DB::table('activos.area')->insertGetId(['codigo' => 'PRUEBA', 'nombre' => 'Área de prueba']);

        return \App\Modules\Activos\Models\CentroCosto::create(['area_id' => $area, 'codigo' => $codigo, 'nombre' => "Centro {$codigo}",
            'almacen_id' => $almacen, 'activo' => true, ...$extra])->id;
    }

    public function test_con_acopios_marcados_la_carga_solo_entra_por_ellos(): void
    {
        $this->prepararBaseCargas();
        $this->filaConId('almacenes', 2);
        $this->centro('ADM_POTOSI', 1, ['es_central' => true]);
        $this->centro('ACOPIO_PORCO', 2, ['es_acopio' => true]);
        $ana = $this->usuario(['cargas.ver', 'cargas.recibir', 'cargas.ver-todos-almacenes']);

        Sanctum::actingAs($ana);
        // Solo el acopio aparece para recibir, con el nombre del centro de costo.
        $this->getJson('/api/cargas/opciones')->assertOk()
            ->assertJsonCount(1, 'data.sedes_recepcion')
            ->assertJsonPath('data.sedes_recepcion.0.id', 2)
            ->assertJsonPath('data.sedes_recepcion.0.centro_costo.codigo', 'ACOPIO_PORCO');
        $this->recibir(1)->assertStatus(422);
        $lote = $this->recibir(2)->assertCreated()->json('data');
        $this->assertSame('ACOPIO_PORCO', $lote['almacen']['centro_costo']['codigo']);

        // Y la base lo exige aunque se salte la API.
        $this->expectExceptionMessage('no es de un acopio');
        \Illuminate\Support\Facades\DB::table('cargas.lote')->insert(['serie_id' => SerieLote::where('prefijo', 'CZP')->value('id'),
            'almacen_id' => 1, 'productor_id' => Productor::first()->id, 'registrado_por' => $ana->id]);
    }

    public function test_cada_almacen_es_de_un_centro_y_hay_una_sola_central(): void
    {
        $this->prepararBaseCargas();
        $this->filaConId('almacenes', 2);
        $this->centro('UNO', 1, ['es_central' => true]);
        try {
            \Illuminate\Support\Facades\DB::transaction(fn () => $this->centro('DOS', 1));    // en su punto de guardado
            $this->fail('Dos centros con el mismo almacén');
        } catch (\Illuminate\Database\QueryException $e) {
            $this->assertStringContainsString('ya es del centro de costo UNO', $e->getMessage());
        }
        $this->expectExceptionMessage('ux_cc_una_central');
        $this->centro('TRES', 2, ['es_central' => true]);
    }

    public function test_se_crean_areas_para_agrupar_centros(): void
    {
        $this->prepararBaseCargas();
        $this->filaConId('almacenes', 2);
        $sin = $this->usuario(['activos.ver']);
        Sanctum::actingAs($sin);
        $this->postJson('/api/activos/areas', ['codigo' => 'PORCO', 'nombre' => 'Zona Porco'])->assertForbidden();

        Sanctum::actingAs($this->usuario(['activos.ver', 'activos-config.administrar']));
        $id = $this->postJson('/api/activos/areas', ['codigo' => 'PORCO', 'nombre' => 'Zona Porco'])
            ->assertCreated()->json('data.id');
        $this->postJson('/api/activos/areas', ['codigo' => 'PORCO', 'nombre' => 'Otra'])->assertUnprocessable();
        $this->getJson('/api/activos/areas')->assertOk()->assertJsonFragment(['codigo' => 'PORCO']);
        $this->postJson('/api/activos/centros-costo', ['area_id' => $id, 'codigo' => 'ACOPIO_PORCO', 'nombre' => 'Acopio Porco'])
            ->assertCreated();
    }
}
