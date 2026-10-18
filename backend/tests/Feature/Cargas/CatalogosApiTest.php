<?php

namespace Tests\Feature\Cargas;

use App\Modules\Cargas\Models\Cooperativa;
use App\Modules\Cargas\Models\Elemento;
use App\Modules\Cargas\Models\Mina;
use App\Modules\Cargas\Models\Municipio;
use App\Modules\Cargas\Models\Productor;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CatalogosApiTest extends TestCase
{
    use ActuaConPermisos;
    use PreparaBaseCargas;
    use RefreshDatabase;

    private const ESCRIBIR = ['cargas.ver', 'cargas.catalogos'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
    }

    // ------------------------------------------------------------- Permisos

    public function test_sin_autenticar_devuelve_401(): void
    {
        $this->getJson('/api/cargas/productores')->assertUnauthorized();
    }

    public function test_leer_no_habilita_escribir(): void
    {
        $this->actuarCon(['cargas.ver']);

        $this->getJson('/api/cargas/cooperativas')->assertOk();
        $this->postJson('/api/cargas/cooperativas', ['nombre' => 'Coop'])->assertForbidden();
    }

    public function test_los_bancos_se_leen_sin_permisos_de_cargas(): void
    {
        $this->actuarCon([]);

        $this->getJson('/api/cargas/bancos')->assertOk();
        $this->getJson('/api/cargas/productores')->assertForbidden();
    }

    // ----------------------------------------------------------- Productores

    public function test_registra_un_cooperativista(): void
    {
        $this->actuarCon(self::ESCRIBIR);
        $coop = Cooperativa::create(['nombre' => 'Unificada R.L.']);

        $this->postJson('/api/cargas/productores', [
            'tipo' => 'COOPERATIVISTA', 'nombre' => '  Juan   Pérez ', 'ci' => '1234567 pt', 'cooperativa_id' => $coop->id,
        ])->assertCreated()
          ->assertJsonPath('data.nombre', 'Juan Pérez')
          ->assertJsonPath('data.ci', '1234567 PT')
          ->assertJsonPath('data.cooperativa.nombre', 'Unificada R.L.');
    }

    public function test_productor_necesita_ci_o_nit_y_el_cooperativista_su_cooperativa(): void
    {
        $this->actuarCon(self::ESCRIBIR);

        $this->postJson('/api/cargas/productores', ['tipo' => 'COOPERATIVISTA', 'nombre' => 'Sin datos'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['ci', 'nit', 'cooperativa_id']);
    }

    public function test_un_particular_no_queda_atado_a_una_cooperativa(): void
    {
        $this->actuarCon(self::ESCRIBIR);
        $coop = Cooperativa::create(['nombre' => 'Unificada R.L.']);

        $this->postJson('/api/cargas/productores', [
            'tipo' => 'PARTICULAR', 'nombre' => 'Ana', 'ci' => '555', 'cooperativa_id' => $coop->id,
        ])->assertCreated()->assertJsonPath('data.cooperativa_id', null);
    }

    public function test_ci_repetido_se_rechaza(): void
    {
        $this->actuarCon(self::ESCRIBIR);
        Productor::create(['tipo' => 'PARTICULAR', 'nombre' => 'Uno', 'ci' => '777']);

        $this->postJson('/api/cargas/productores', ['tipo' => 'PARTICULAR', 'nombre' => 'Dos', 'ci' => '777'])
            ->assertStatus(422)
            ->assertJsonPath('errors.ci.0', 'Ya hay un productor registrado con ese CI.');
    }

    public function test_busca_por_nombre_sin_tildes_y_por_ci_con_paginacion(): void
    {
        $this->actuarCon(['cargas.ver']);
        Productor::create(['tipo' => 'PARTICULAR', 'nombre' => 'Germán Quispe', 'ci' => '111']);
        Productor::create(['tipo' => 'PARTICULAR', 'nombre' => 'Rosa Mamani', 'ci' => '222']);
        Productor::create(['tipo' => 'PARTICULAR', 'nombre' => 'Luis Choque', 'ci' => '333']);

        $this->getJson('/api/cargas/productores?buscar=german')
            ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.nombre', 'Germán Quispe');

        $this->getJson('/api/cargas/productores?buscar=222')->assertJsonPath('data.0.nombre', 'Rosa Mamani');

        $this->getJson('/api/cargas/productores?por_pagina=5')->assertJsonPath('per_page', 5)->assertJsonPath('total', 3);
    }

    public function test_desactivar_un_productor_no_lo_borra(): void
    {
        $this->actuarCon(self::ESCRIBIR);
        $p = Productor::create(['tipo' => 'PARTICULAR', 'nombre' => 'Uno', 'ci' => '9']);

        $this->deleteJson("/api/cargas/productores/{$p->id}")->assertOk()->assertJsonPath('data.activo', false);
        $this->assertDatabaseHas('cargas.productor', ['id' => $p->id, 'activo' => false]);
    }

    // ---------------------------------------------------------- Cooperativas

    public function test_cooperativa_repetida_aunque_cambien_mayusculas_y_espacios(): void
    {
        $this->actuarCon(self::ESCRIBIR);
        Cooperativa::create(['nombre' => 'Cerro Rico R.L.']);

        $this->postJson('/api/cargas/cooperativas', ['nombre' => '  CERRO   RICO r.l. '])
            ->assertStatus(422)
            ->assertJsonPath('errors.nombre.0', 'Ya existe la cooperativa «Cerro Rico R.L.».');
    }

    public function test_cooperativa_con_productores_activos_no_se_desactiva(): void
    {
        $this->actuarCon(self::ESCRIBIR);
        $coop = Cooperativa::create(['nombre' => 'Porco R.L.']);
        Productor::create(['tipo' => 'COOPERATIVISTA', 'nombre' => 'Socio', 'ci' => '1', 'cooperativa_id' => $coop->id]);

        $this->deleteJson("/api/cargas/cooperativas/{$coop->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, '1 productor(es)'));
    }

    // ----------------------------------------------------- Minas y bocaminas

    public function test_una_mina_propia_no_tiene_cooperativa(): void
    {
        $this->actuarCon(self::ESCRIBIR);
        $coop = Cooperativa::create(['nombre' => 'Porco R.L.']);

        $this->postJson('/api/cargas/minas', ['nombre' => 'Mina propia', 'propia' => true, 'cooperativa_id' => $coop->id])
            ->assertCreated()
            ->assertJsonPath('data.propia', true)
            ->assertJsonPath('data.cooperativa_id', null);
    }

    public function test_el_nombre_de_mina_se_repite_solo_en_otra_cooperativa(): void
    {
        $this->actuarCon(self::ESCRIBIR);
        $a = Cooperativa::create(['nombre' => 'A R.L.']);
        $b = Cooperativa::create(['nombre' => 'B R.L.']);
        Mina::create(['nombre' => 'San José', 'cooperativa_id' => $a->id]);

        $this->postJson('/api/cargas/minas', ['nombre' => 'san josé', 'propia' => false, 'cooperativa_id' => $a->id])
            ->assertStatus(422)->assertJsonValidationErrors('nombre');
        $this->postJson('/api/cargas/minas', ['nombre' => 'San José', 'propia' => false, 'cooperativa_id' => $b->id])
            ->assertCreated();
    }

    public function test_bocaminas_de_una_mina(): void
    {
        $this->actuarCon(self::ESCRIBIR);
        $mina = Mina::create(['nombre' => 'Propia', 'propia' => true]);

        $this->postJson("/api/cargas/minas/{$mina->id}/bocaminas", ['codigo' => 'bm-1', 'nombre' => 'Nivel 1'])
            ->assertCreated()->assertJsonPath('data.codigo', 'BM-1');
        $this->postJson("/api/cargas/minas/{$mina->id}/bocaminas", ['codigo' => 'BM-1'])
            ->assertStatus(422)->assertJsonPath('errors.codigo.0', 'Esa mina ya tiene una bocamina con ese código.');

        $this->getJson("/api/cargas/minas/{$mina->id}/bocaminas")->assertJsonCount(1, 'data');
        $this->deleteJson("/api/cargas/minas/{$mina->id}")->assertStatus(422);
    }

    public function test_una_mina_con_lotes_no_cambia_de_ajena_a_propia(): void
    {
        $this->actuarCon(self::ESCRIBIR);
        $mina = Mina::create(['nombre' => 'Ajena']);
        $p = Productor::create(['tipo' => 'PARTICULAR', 'nombre' => 'Uno', 'ci' => '1']);
        $this->crearLote('CZP', $p->id, $mina->id);

        $this->putJson("/api/cargas/minas/{$mina->id}", ['nombre' => 'Ajena', 'propia' => true])
            ->assertStatus(422)
            ->assertJsonPath('message', 'La mina «Ajena» ya tiene lotes: no puede pasar de ajena a propia.');
    }

    // ------------------------------------------------- Municipios y otros

    public function test_un_municipio_en_uso_no_se_elimina(): void
    {
        $this->actuarCon(self::ESCRIBIR);
        $m = Municipio::create(['nombre' => 'Porco']);
        Cooperativa::create(['nombre' => 'Porco R.L.', 'municipio_id' => $m->id]);

        $this->deleteJson("/api/cargas/municipios/{$m->id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'No se puede eliminar: hay otros registros que dependen de este.');

        $libre = Municipio::create(['nombre' => 'Uyuni']);
        $this->deleteJson("/api/cargas/municipios/{$libre->id}")->assertOk();
    }

    public function test_municipio_repetido_en_el_mismo_departamento(): void
    {
        $this->actuarCon(self::ESCRIBIR);
        Municipio::create(['nombre' => 'Porco']);

        $this->postJson('/api/cargas/municipios', ['nombre' => 'Porco'])->assertStatus(422)->assertJsonValidationErrors('nombre');
        $this->postJson('/api/cargas/municipios', ['nombre' => 'Porco', 'departamento' => 'oruro'])->assertCreated();
    }

    public function test_laboratorios_y_bancos(): void
    {
        $this->actuarCon(self::ESCRIBIR);

        $this->postJson('/api/cargas/laboratorios', ['nombre' => 'SENARECOM Potosí', 'acreditado' => true])->assertCreated();
        $this->postJson('/api/cargas/laboratorios', ['nombre' => 'SENARECOM Potosí'])->assertStatus(422);
        $this->postJson('/api/cargas/bancos', ['nombre' => 'Banco Unión'])->assertCreated();
        $this->postJson('/api/cargas/bancos', ['nombre' => 'Banco Unión'])->assertStatus(422);
    }

    // ----------------------------------------------------- Elementos y líneas

    public function test_la_unidad_de_un_elemento_con_analisis_queda_fija(): void
    {
        $this->actuarCon(self::ESCRIBIR);
        $ag = Elemento::where('codigo', 'AG')->first();

        // Sin datos: se puede cambiar (la decisión pendiente de DM vs g/TM).
        $this->putJson("/api/cargas/elementos/{$ag->id}", ['nombre' => 'Plata', 'unidad_ley' => 'G_TM'])->assertOk();

        DB::insert("insert into cargas.cotizacion (elemento_id, anio, mes, quincena, valor, unidad, registrado_por) values (?, 2026, 11, 1, 50, 'OT', 1)", [$ag->id]);

        $this->putJson("/api/cargas/elementos/{$ag->id}", ['nombre' => 'Plata', 'unidad_ley' => 'DM'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'El elemento AG ya tiene cotizaciones registrados en G_TM: su unidad de ley no se cambia.');

        $this->getJson('/api/cargas/elementos')->assertJsonPath('data.0.codigo', 'H2O');
    }

    public function test_el_codigo_de_un_elemento_no_se_edita_y_la_humedad_no_se_desactiva(): void
    {
        $this->actuarCon(self::ESCRIBIR);
        $h2o = Elemento::where('codigo', 'H2O')->first();

        $this->putJson("/api/cargas/elementos/{$h2o->id}", ['codigo' => 'HUM', 'nombre' => 'Humedad', 'unidad_ley' => '%'])
            ->assertStatus(422)->assertJsonValidationErrors('codigo');
        $this->putJson("/api/cargas/elementos/{$h2o->id}", ['nombre' => 'Humedad', 'unidad_ley' => '%', 'activo' => false])
            ->assertStatus(422)->assertJsonPath('message', fn ($m) => str_contains($m, 'no se desactiva'));
    }

    public function test_una_linea_necesita_un_elemento_pagable_y_sincroniza_sus_elementos(): void
    {
        $this->actuarCon(self::ESCRIBIR);
        $ag = Elemento::where('codigo', 'AG')->value('id');
        $zn = Elemento::where('codigo', 'ZN')->value('id');
        $as = Elemento::where('codigo', 'AS')->value('id');

        $base = ['codigo' => 'conc_ag', 'nombre' => 'Concentrado de plata', 'forma' => 'CONCENTRADO', 'modalidad_precio' => 'VALORACION_CONCENTRADO'];

        $this->postJson('/api/cargas/lineas', [...$base, 'elementos' => [['elemento_id' => $as, 'rol' => 'PENALIZABLE']]])
            ->assertStatus(422)->assertJsonValidationErrors('elementos');

        $id = $this->postJson('/api/cargas/lineas', [...$base, 'elementos' => [
            ['elemento_id' => $ag, 'rol' => 'PAGABLE', 'split_limit' => 0.5],
            ['elemento_id' => $as, 'rol' => 'PENALIZABLE'],
        ]])->assertCreated()->assertJsonPath('data.codigo', 'CONC_AG')->json('data.id');

        $this->putJson("/api/cargas/lineas/{$id}", [...$base, 'elementos' => [
            ['elemento_id' => $ag, 'rol' => 'PAGABLE', 'split_limit' => 0.7],
            ['elemento_id' => $zn, 'rol' => 'INFORMATIVO'],
        ]])->assertOk()->assertJsonCount(2, 'data.elementos');

        $this->assertDatabaseMissing('cargas.linea_producto_elemento', ['linea_producto_id' => $id, 'elemento_id' => $as]);
        $this->assertDatabaseHas('cargas.linea_producto_elemento', ['linea_producto_id' => $id, 'elemento_id' => $ag, 'split_limit' => 0.7]);
    }

    public function test_opciones_para_los_desplegables(): void
    {
        $this->actuarCon(['cargas.ver']);

        $this->getJson('/api/cargas/opciones')
            ->assertOk()
            ->assertJsonPath('data.tipos_productor.0.valor', 'COOPERATIVISTA')
            ->assertJsonPath('data.departamentos.4.etiqueta', 'Potosí')
            ->assertJsonCount(4, 'data.reinicios');
    }
}
