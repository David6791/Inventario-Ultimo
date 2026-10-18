<?php

namespace Tests\Feature\Cargas;

use App\Models\User;
use App\Modules\Cargas\Models\Cooperativa;
use App\Modules\Cargas\Models\Elemento;
use App\Modules\Cargas\Models\Laboratorio;
use App\Modules\Cargas\Models\Mina;
use App\Modules\Cargas\Models\Municipio;
use App\Modules\Cargas\Models\Productor;
use App\Modules\Cargas\Models\SerieLote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Sprint 5 — Muestreo, análisis de empresa y productor, dirimencia, ley
 * final, cierre y reapertura.
 */
class LaboratorioApiTest extends TestCase
{
    use PreparaBaseCargas;
    use RefreshDatabase;

    private const RECEPCION   = ['cargas.ver', 'cargas.recibir'];
    private const LABORATORIO = ['cargas.ver', 'cargas.muestrear', 'cargas.cargar-analisis'];
    private const JEFE        = ['cargas.ver', 'cargas.fijar-ley'];

    private int $lote;
    private array $e = [];
    private array $lab = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
        Storage::fake('local');
        $this->filaConId('almacenes', 2);

        $mun = Municipio::create(['codigo' => '050601', 'nombre' => 'PORCO', 'departamento' => 'POTOSI']);
        $coop = Cooperativa::create(['nombre' => 'COOPERATIVA MINERA PORCO LTDA.', 'municipio_id' => $mun->id]);
        $prod = Productor::create(['tipo' => 'COOPERATIVISTA', 'nombre' => 'JUAN MAMANI', 'ci' => '4455667', 'cooperativa_id' => $coop->id]);
        $mina = Mina::create(['nombre' => 'SANTA ROSA', 'cooperativa_id' => $coop->id, 'municipio_id' => $mun->id]);

        foreach (['AG', 'ZN', 'PB', 'H2O', 'SN'] as $c) {
            $this->e[$c] = Elemento::where('codigo', $c)->value('id');
        }
        $linea = SerieLote::where('prefijo', 'CZP')->value('linea_producto_id');
        DB::table('cargas.linea_producto_elemento')->where('linea_producto_id', $linea)->where('elemento_id', $this->e['AG'])->update(['split_limit' => 0.5]);
        DB::table('cargas.linea_producto_elemento')->where('linea_producto_id', $linea)->where('elemento_id', $this->e['ZN'])->update(['split_limit' => 0.6]);

        foreach (['PROPIO' => true, 'PRODUCTOR' => false, 'DIRIMENTE' => false] as $n => $propio) {
            $this->lab[$n] = Laboratorio::create(['nombre' => "LABORATORIO {$n}", 'propio' => $propio])->id;
        }

        $this->como($this->usuario(self::RECEPCION));
        $this->lote = $this->postJson('/api/cargas/lotes', [
            'serie_id' => SerieLote::where('prefijo', 'CZP')->value('id'), 'almacen_id' => 1,
            'productor_id' => $prod->id, 'mina_id' => $mina->id,
            'pesaje' => ['bascula' => 'POTOSÍ 1', 'ticket' => 'T-1', 'peso_bruto_kg' => 12500, 'tara_kg' => 4300, 'chofer_nombre' => 'PEDRO QUISPE'],
        ])->assertCreated()->json('data.id');
    }

    private function usuario(array $permisos, array $almacenes = [1]): User
    {
        $u = User::factory()->create();
        $u->givePermissionTo($permisos);
        $u->almacenes()->sync($almacenes);

        return $u;
    }

    private function como(User $u): User
    {
        Sanctum::actingAs($u->fresh());

        return $u;
    }

    private function muestra(array $cambios = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson("/api/cargas/lotes/{$this->lote}/muestras", [
            'metodo' => 'cuarteo', 'peso_g' => 1500,
            'porciones' => [
                ['destino' => 'EMPRESA', 'precinto' => 'p-001'],
                ['destino' => 'PRODUCTOR', 'precinto' => 'p-002', 'entregada_a' => 'juan mamani'],
                ['destino' => 'TESTIGO', 'precinto' => 'p-003'],
            ],
            ...$cambios,
        ]);
    }

    private function analisis(int $muestra, string $tipo, string $lab, array $valores, array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->post("/api/cargas/muestras/{$muestra}/analisis", [
            'tipo' => $tipo, 'laboratorio_id' => $this->lab[$lab], 'numero_certificado' => "{$tipo}-" . random_int(100, 999),
            'resultados' => collect($valores)->map(fn ($v, $c) => ['elemento_id' => $this->e[$c], 'valor' => $v])->values()->all(),
            ...$extra,
        ], ['Accept' => 'application/json']);
    }

    /** Muestra + análisis de empresa (con certificado) y del productor; Ag excede el split limit. */
    private function conAnalisis(): int
    {
        $this->como($this->usuario(self::LABORATORIO));
        $m = $this->muestra()->assertCreated()->json('data.id');
        $this->analisis($m, 'EMPRESA', 'PROPIO', ['AG' => 10.20, 'ZN' => 18.50, 'H2O' => 7.00],
            ['certificado' => UploadedFile::fake()->create('certificado.pdf', 120, 'application/pdf')])->assertCreated();
        $this->analisis($m, 'PRODUCTOR', 'PRODUCTOR', ['AG' => 10.90, 'ZN' => 18.70, 'H2O' => 7.20])->assertCreated();

        return $m;
    }

    private function ley(string $elemento, array $datos): \Illuminate\Testing\TestResponse
    {
        return $this->putJson("/api/cargas/lotes/{$this->lote}/leyes/{$this->e[$elemento]}", $datos);
    }

    // ------------------------------------------------------------------ tests

    public function test_registrar_la_muestra_con_tres_porciones_pasa_el_lote_a_muestreado(): void
    {
        $this->como($this->usuario(self::RECEPCION));
        $this->muestra()->assertForbidden();

        $this->como($this->usuario(self::LABORATORIO));
        $this->muestra(['porciones' => [['destino' => 'EMPRESA', 'precinto' => 'A']]])->assertUnprocessable()
            ->assertJsonValidationErrors('porciones');

        $r = $this->muestra()->assertCreated()
            ->assertJsonPath('data.tipo', 'PRINCIPAL')
            ->assertJsonPath('data.porciones.0.precinto', 'P-001')
            ->assertJsonPath('data.porciones.1.entregada_a', 'JUAN MAMANI');
        $this->assertStringEndsWith('-M1', $r->json('data.codigo'));

        $lote = $this->getJson("/api/cargas/lotes/{$this->lote}")->assertOk()->assertJsonPath('data.estado', 'MUESTREADO');
        $this->assertStringStartsWith('Muestra ', collect($lote->json('data.eventos'))->last()['detalle']);

        // Precintos ya usados: no se repiten en otra muestra.
        $this->muestra()->assertUnprocessable()->assertJsonValidationErrors('porciones');

        $pdf = $this->get("/api/cargas/muestras/{$r->json('data.id')}/etiquetas")->assertOk();
        $this->assertSame('application/pdf', $pdf->headers->get('Content-Type'));
    }

    public function test_comparacion_dirimencia_ley_final_y_peso_seco(): void
    {
        $m = $this->conAnalisis();

        $lab = $this->getJson("/api/cargas/lotes/{$this->lote}/laboratorio")->assertOk();
        $ensayes = collect($lab->json('data.ensayes'))->keyBy('elemento');
        $this->assertTrue($ensayes['AG']['excede_split_limit']);
        $this->assertFalse($ensayes['ZN']['excede_split_limit']);
        $this->assertEquals(18.60, (float) $ensayes['ZN']['promedio']);
        $this->assertSame('PROMEDIO', $lab->json('data.criterio_sugerido'));
        $this->assertTrue($lab->json('data.muestras.0.analisis.0.con_certificado'));
        $this->assertArrayNotHasKey('archivo_path', $lab->json('data.muestras.0.analisis.0'));

        // El laboratorista no fija leyes: lo hace el jefe de compras.
        $this->ley('ZN', ['criterio' => 'PROMEDIO'])->assertForbidden();

        $this->como($this->usuario(self::JEFE));
        $this->ley('ZN', ['criterio' => 'PROMEDIO'])->assertOk()->assertJsonPath('data.valor', '18.6000');
        $this->ley('AG', ['criterio' => 'PROMEDIO'])->assertUnprocessable()
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'excede el split limit'));
        $this->ley('H2O', ['criterio' => 'PROMEDIO'])->assertOk()->assertJsonPath('data.valor', '7.1000');
        $this->postJson("/api/cargas/lotes/{$this->lote}/cerrar-analisis")->assertUnprocessable()
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'Falta la ley final de: AG'));

        // Dirimencia: laboratorio distinto a los dos anteriores.
        $this->como($this->usuario(self::LABORATORIO));
        $this->analisis($m, 'DIRIMENTE', 'PROPIO', ['AG' => 10.50])->assertUnprocessable()
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'distinto'));
        $this->analisis($m, 'DIRIMENTE', 'DIRIMENTE', ['AG' => 10.50])->assertCreated();

        $this->como($this->usuario(self::JEFE));
        $this->ley('AG', ['criterio' => 'DIRIMENTE'])->assertOk()->assertJsonPath('data.valor', '10.5000');
        $this->postJson("/api/cargas/lotes/{$this->lote}/cerrar-analisis")->assertOk()->assertJsonPath('data.estado', 'ANALIZADO');

        $this->getJson("/api/cargas/lotes/{$this->lote}")->assertOk()
            ->assertJsonPath('data.peso_neto_seco_kg', '7617.80')
            ->assertJsonPath('data.ley_ag', '10.5000')
            ->assertJsonPath('data.humedad_pct', '7.1000');
    }

    public function test_acuerdo_exige_valor_y_observacion(): void
    {
        $this->conAnalisis();
        $this->como($this->usuario(self::JEFE));

        $this->ley('AG', ['criterio' => 'ACUERDO'])->assertUnprocessable()->assertJsonValidationErrors(['valor', 'observacion']);
        $this->ley('AG', ['criterio' => 'ACUERDO', 'valor' => 10.6, 'observacion' => 'Acuerdo con el productor, acta 12'])
            ->assertOk()->assertJsonPath('data.valor', '10.6000');
        // Cambiar de criterio deja la ley anterior en el historial.
        $this->ley('ZN', ['criterio' => 'PROMEDIO'])->assertOk();
        $this->ley('ZN', ['criterio' => 'EMPRESA'])->assertOk()->assertJsonPath('data.valor', '18.5000');

        $historial = $this->getJson("/api/cargas/lotes/{$this->lote}/laboratorio")->json('data.historial');
        $this->assertSame('CAMBIADA', $historial[0]['accion']);
        $this->assertSame('PROMEDIO', $historial[0]['criterio']);
    }

    public function test_certificado_privado_y_anulacion_de_analisis(): void
    {
        $this->conAnalisis();
        $lab = $this->getJson("/api/cargas/lotes/{$this->lote}/laboratorio")->json('data');
        $emp = $lab['muestras'][0]['analisis'][0];
        $pro = $lab['muestras'][0]['analisis'][1];

        $this->get("/api/cargas/analisis/{$emp['id']}/certificado")->assertOk();
        $this->get("/api/cargas/analisis/{$pro['id']}/certificado")->assertNotFound();
        $this->post("/api/cargas/analisis/{$pro['id']}/certificado",
            ['archivo' => UploadedFile::fake()->image('foto.jpg')], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('data.con_certificado', true);

        $otro = $this->como($this->usuario(self::LABORATORIO, [2]));
        $this->get("/api/cargas/analisis/{$emp['id']}/certificado")->assertForbidden();

        $this->como($this->usuario(self::JEFE));
        $this->ley('ZN', ['criterio' => 'PROMEDIO'])->assertOk();

        $this->como($this->usuario(self::LABORATORIO));
        $this->postJson("/api/cargas/analisis/{$pro['id']}/anular", ['motivo' => 'corto'])->assertUnprocessable();
        $this->postJson("/api/cargas/analisis/{$pro['id']}/anular", ['motivo' => 'Certificado del productor ilegible'])->assertOk();

        $lab = $this->getJson("/api/cargas/lotes/{$this->lote}/laboratorio")->json('data');
        $this->assertSame([], $lab['leyes'], 'la ley de zinc dependía del análisis anulado');
        $this->assertTrue($lab['muestras'][0]['analisis'][1]['anulado']);
        $this->analisis($lab['muestras'][0]['id'], 'PRODUCTOR', 'PRODUCTOR', ['AG' => 10.40, 'ZN' => 18.70, 'H2O' => 7.20])->assertCreated();
    }

    public function test_reabrir_y_remuestrear(): void
    {
        $m1 = $this->conAnalisis();
        $this->analisis($m1, 'DIRIMENTE', 'DIRIMENTE', ['AG' => 10.50])->assertCreated();
        $this->como($this->usuario(self::JEFE));
        foreach (['ZN' => 'PROMEDIO', 'H2O' => 'PROMEDIO', 'AG' => 'DIRIMENTE'] as $c => $criterio) {
            $this->ley($c, ['criterio' => $criterio])->assertOk();
        }
        $this->postJson("/api/cargas/lotes/{$this->lote}/cerrar-analisis")->assertOk();

        $this->ley('ZN', ['criterio' => 'EMPRESA'])->assertUnprocessable();   // ANALIZADO: no se tocan
        $this->postJson("/api/cargas/lotes/{$this->lote}/reabrir", [])->assertUnprocessable()->assertJsonValidationErrors('motivo');
        $this->postJson("/api/cargas/lotes/{$this->lote}/reabrir", ['motivo' => 'El productor pide remuestreo'])->assertOk()
            ->assertJsonPath('data.estado', 'MUESTREADO');

        $this->como($this->usuario(self::LABORATORIO));
        $r = $this->muestra(['porciones' => [
            ['destino' => 'EMPRESA', 'precinto' => 'P-101'], ['destino' => 'PRODUCTOR', 'precinto' => 'P-102'],
            ['destino' => 'TESTIGO', 'precinto' => 'P-103'],
        ]])->assertCreated()->assertJsonPath('data.tipo', 'REMUESTREO');
        $this->assertStringEndsWith('-M2', $r->json('data.codigo'));

        $lab = $this->getJson("/api/cargas/lotes/{$this->lote}/laboratorio")->json('data');
        $this->assertSame([], $lab['leyes']);
        $this->assertSame([], $lab['ensayes'], 'la comparación es de la muestra vigente');
        $this->assertCount(3, collect($lab['historial'])->where('accion', 'QUITADA'));

        $this->analisis($m1, 'EMPRESA', 'PROPIO', ['AG' => 10])->assertUnprocessable()
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'no es la última'));

        $eventos = collect($this->getJson("/api/cargas/lotes/{$this->lote}")->json('data.eventos'));
        $this->assertSame('Reabierto: El productor pide remuestreo', $eventos->last()['detalle']);
    }

    public function test_lectura_estimada_y_bandeja(): void
    {
        $this->como($this->usuario(self::RECEPCION));
        $this->putJson("/api/cargas/lotes/{$this->lote}/lectura-estimada", [
            'metodo' => 'Analizador portátil',
            'lecturas' => [['elemento_id' => $this->e['AG'], 'valor' => 11], ['elemento_id' => $this->e['ZN'], 'valor' => 19]],
        ])->assertOk();
        $this->putJson("/api/cargas/lotes/{$this->lote}/lectura-estimada", [
            'lecturas' => [['elemento_id' => $this->e['SN'], 'valor' => 1]],
        ])->assertUnprocessable();

        $this->como($this->usuario(self::LABORATORIO));
        $b = $this->getJson('/api/cargas/laboratorio/bandeja')->assertOk();
        $this->assertSame('RECIBIDO', $b->json('data.0.estado'));
        $this->assertSame(3, $b->json('data.0.leyes_requeridas'));   // H2O, AG, ZN

        $this->conAnalisis();
        $b = $this->getJson('/api/cargas/laboratorio/bandeja?estado=MUESTREADO')->assertOk();
        $this->assertTrue($b->json('data.0.con_empresa') && $b->json('data.0.con_productor'));
        $this->assertTrue($b->json('data.0.requiere_dirimencia'));

        $this->como($this->usuario(self::LABORATORIO, [2]));
        $this->getJson('/api/cargas/laboratorio/bandeja')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("/api/cargas/lotes/{$this->lote}/laboratorio")->assertForbidden();

        $this->como($this->usuario(self::LABORATORIO));
        $lecturas = $this->getJson("/api/cargas/lotes/{$this->lote}/laboratorio")->json('data.lecturas');
        $this->assertCount(2, $lecturas);
    }
}
