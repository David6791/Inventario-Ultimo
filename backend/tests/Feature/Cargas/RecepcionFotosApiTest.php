<?php

namespace Tests\Feature\Cargas;

use App\Models\User;
use App\Modules\Cargas\Models\Cooperativa;
use App\Modules\Cargas\Models\Mina;
use App\Modules\Cargas\Models\Municipio;
use App\Modules\Cargas\Models\Pesaje;
use App\Modules\Cargas\Models\Productor;
use App\Modules\Cargas\Models\RecepcionFoto;
use App\Modules\Cargas\Models\SerieLote;
use App\Modules\Cargas\Services\OcrTicketService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Recepción con fotos: plantillas de báscula con OCR, báscula, solo sacos y mixta (dos lotes). */
class RecepcionFotosApiTest extends TestCase
{
    use PreparaBaseCargas;
    use RefreshDatabase;

    private User $recepcion;
    private User $admin;
    private Productor $productor;
    private Mina $mina;

    /** Recuadros del ticket de prueba (800 × 1100, ver ticket()). */
    private const CAMPOS = [
        ['campo' => 'ticket',        'x' => 0.31, 'y' => 0.135, 'w' => 0.22, 'h' => 0.045],
        ['campo' => 'peso_bruto_kg', 'x' => 0.42, 'y' => 0.382, 'w' => 0.21, 'h' => 0.05, 'etiqueta' => 'BRUTO'],
        ['campo' => 'tara_kg',       'x' => 0.42, 'y' => 0.455, 'w' => 0.21, 'h' => 0.05, 'etiqueta' => 'TARA'],
        ['campo' => 'peso_neto_kg',  'x' => 0.42, 'y' => 0.527, 'w' => 0.21, 'h' => 0.05, 'etiqueta' => 'NETO'],
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
        Storage::fake('local');
        DB::table('cargas.parametro')->where('clave', 'FOTO_TICKET_OBLIGATORIA')->update(['valor' => 'SI']);

        $m = Municipio::create(['codigo' => '050601', 'nombre' => 'PORCO', 'departamento' => 'POTOSI']);
        $c = Cooperativa::create(['nombre' => 'COOPERATIVA PORCO', 'municipio_id' => $m->id]);
        $this->productor = Productor::create(['tipo' => 'COOPERATIVISTA', 'nombre' => 'PRODUCTOR PRUEBA', 'ci' => '1000001', 'cooperativa_id' => $c->id]);
        $this->mina = Mina::create(['nombre' => 'SANTA ROSA', 'cooperativa_id' => $c->id, 'municipio_id' => $m->id]);
        DB::table('cargas.bono_transporte_tramo')->insert([
            ['tipo_vehiculo' => 'TONKA',    'peso_desde_kg' => 500,  'peso_hasta_kg' => 10000, 'monto' => 50,  'vigente_desde' => '2026-01-01'],
            ['tipo_vehiculo' => 'DOBLE',    'peso_desde_kg' => 10000, 'peso_hasta_kg' => null, 'monto' => 100, 'vigente_desde' => '2026-01-01'],
        ]);

        $this->recepcion = User::factory()->create();
        $this->recepcion->givePermissionTo(['cargas.ver', 'cargas.recibir']);
        $this->recepcion->almacenes()->sync([1]);
        $this->admin = User::factory()->create();
        $this->admin->givePermissionTo(['cargas.ver', 'cargas.catalogos']);
    }

    // --- Ayudas ---------------------------------------------------------------

    /** Ticket impreso de prueba: 800 × 1100 px, como si ya estuviera enderezado. */
    private function ticket(int $bruto, int $tara, string $numero = '004512'): UploadedFile
    {
        $fuente = collect(['/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf',
                           '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'])->first(fn ($f) => is_file($f));
        $img = imagecreatetruecolor(800, 1100);
        imagefill($img, 0, 0, imagecolorallocate($img, 245, 245, 245));
        $tinta = imagecolorallocate($img, 25, 25, 25);
        $f = fn ($n) => number_format($n, 0, ',', '.');
        foreach ([[60, 95, 'BALANZA DE PRUEBA'], [60, 180, "TICKET N: {$numero}"], [60, 320, 'PLACA: 2345-KLM'],
                  [60, 455, sprintf('BRUTO:     %8s KG', $f($bruto))], [60, 535, sprintf('TARA:      %8s KG', $f($tara))],
                  [60, 615, sprintf('NETO:      %8s KG', $f($bruto - $tara))]] as [$x, $y, $t]) {
            if ($fuente) {
                imagettftext($img, 30, 0, $x, $y, $tinta, $fuente, $t);
            }
        }
        $ruta = tempnam(sys_get_temp_dir(), 'tk') . '.jpg';
        imagejpeg($img, $ruta, 90);
        imagedestroy($img);

        return new UploadedFile($ruta, 'ticket.jpg', 'image/jpeg', null, true);
    }

    private function foto(string $tipo, ?int $plantilla = null): array
    {
        Sanctum::actingAs($this->recepcion);

        return $this->post('/api/cargas/fotos', array_filter([
            'tipo' => $tipo, 'imagen' => UploadedFile::fake()->image('f.jpg', 600, 800), 'plantilla_id' => $plantilla,
        ]), ['Accept' => 'application/json'])->assertCreated()->json('data');
    }

    private function base(array $extra = []): array
    {
        return ['serie_id' => SerieLote::where('prefijo', 'CZP')->value('id'), 'almacen_id' => 1,
                'productor_id' => $this->productor->id, 'mina_id' => $this->mina->id, ...$extra];
    }

    private function camion(array $extra = []): array
    {
        return ['bascula' => 'Báscula interior', 'ticket' => '7001', 'peso_bruto_kg' => 20000, 'tara_kg' => 8000,
                'placa' => '2345KLM', 'chofer_nombre' => 'CHOFER PRUEBA', ...$extra];
    }

    /**
     * Las reglas diferidas corren al confirmar la transacción, y la prueba nunca
     * confirma (RefreshDatabase): se fuerzan aquí.
     */
    private function reglasDiferidas(): void
    {
        DB::statement('SET CONSTRAINTS ALL IMMEDIATE');
        DB::statement('SET CONSTRAINTS ALL DEFERRED');
    }

    // --- Plantillas y OCR -----------------------------------------------------

    public function test_plantilla_con_muestra_y_lectura_de_un_ticket(): void
    {
        Sanctum::actingAs($this->admin);
        $id = $this->post('/api/cargas/plantillas-bascula', [
            'nombre' => 'Balanza San Cristóbal', 'bascula' => 'san cristobal', 'uso' => 'INTERIOR', 'proporcion' => 0.7273,
            'campos' => json_encode(self::CAMPOS), 'muestra' => $this->ticket(24560, 8320),
        ], ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonPath('data.bascula', 'SAN CRISTOBAL')
            ->assertJsonPath('data.tiene_muestra', true)
            ->json('data.id');
        $this->get("/api/cargas/plantillas-bascula/{$id}/muestra")->assertOk();

        // Recuadro que se sale del ticket.
        $this->post('/api/cargas/plantillas-bascula', [
            'nombre' => 'Otra', 'bascula' => 'X', 'uso' => 'EXTERIOR', 'proporcion' => 0.7,
            'campos' => json_encode([['campo' => 'tara_kg', 'x' => 0.8, 'y' => 0.1, 'w' => 0.3, 'h' => 0.05]]),
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('campos.0.w');

        if (! app(OcrTicketService::class)->disponible()) {
            $this->markTestSkipped('Tesseract no está instalado: la lectura se prueba donde esté.');
        }

        // Lectura al subir la foto del ticket, con la plantilla.
        Sanctum::actingAs($this->recepcion);
        $r = $this->post('/api/cargas/fotos', ['tipo' => 'TICKET_INTERIOR', 'plantilla_id' => $id, 'imagen' => $this->ticket(18200, 7950, '004513')],
            ['Accept' => 'application/json'])->assertCreated();
        $r->assertJsonPath('data.bascula', 'SAN CRISTOBAL')
          ->assertJsonPath('data.lectura.campos.ticket.valor', '004513')
          ->assertJsonPath('data.lectura.campos.peso_bruto_kg.valor', 18200)
          ->assertJsonPath('data.lectura.campos.tara_kg.valor', 7950)
          ->assertJsonPath('data.lectura.campos.peso_neto_kg.valor', 10250)
          ->assertJsonPath('data.lectura.coherente', true);

        // Probar recuadros sin guardar nada.
        Sanctum::actingAs($this->admin);
        $this->post('/api/cargas/plantillas-bascula/probar', ['campos' => json_encode(self::CAMPOS), 'imagen' => $this->ticket(31010, 9480)],
            ['Accept' => 'application/json'])->assertOk()->assertJsonPath('data.campos.peso_neto_kg.valor', 21530);
    }

    // --- Báscula ----------------------------------------------------------------

    public function test_bascula_exige_la_foto_del_ticket_interior_y_la_liga_al_pesaje(): void
    {
        $interior = $this->foto('TICKET_INTERIOR');
        $exterior = $this->foto('TICKET_EXTERIOR');

        $this->postJson('/api/cargas/lotes', $this->base(['pesaje' => $this->camion()]))
            ->assertStatus(422)->assertJsonValidationErrors('pesaje.foto_interior_id');
        // Una foto exterior no sirve como interior.
        $this->postJson('/api/cargas/lotes', $this->base(['pesaje' => $this->camion(['foto_interior_id' => $exterior['id']])]))
            ->assertStatus(422)->assertJsonValidationErrors('pesaje.foto_interior_id');

        $lote = $this->postJson('/api/cargas/lotes', $this->base(['pesaje' => $this->camion([
            'foto_interior_id' => $interior['id'], 'foto_exterior_id' => $exterior['id'], 'peso_cliente_kg' => 12100])]))
            ->assertCreated()->assertJsonPath('data.tipo_recepcion', 'BASCULA')
            ->assertJsonCount(2, 'data.pesajes.0.fotos')->json('data');

        $pesaje = $lote['pesajes'][0]['id'];
        $this->assertSame($pesaje, RecepcionFoto::find($interior['id'])->pesaje_id);
        $this->get("/api/cargas/fotos/{$interior['id']}")->assertOk();

        // La foto ya es respaldo: no se reutiliza ni se borra.
        $otra = $this->postJson('/api/cargas/lotes', $this->base(['pesaje' => $this->camion(['ticket' => '7002', 'foto_interior_id' => $interior['id']])]));
        $otra->assertStatus(422)->assertJsonValidationErrors('pesaje.foto_interior_id');
        $this->expectExceptionMessage('respaldo de un pesaje');
        RecepcionFoto::find($interior['id'])->delete();
    }

    // --- Solo sacos -----------------------------------------------------------

    public function test_solo_sacos_suma_las_pesadas_cada_una_con_su_foto_y_sin_bono(): void
    {
        $f1 = $this->foto('BALANZA_MANUAL');
        $f2 = $this->foto('BALANZA_MANUAL');
        $f3 = $this->foto('BALANZA_MANUAL');

        $this->postJson('/api/cargas/lotes', $this->base(['tipo_recepcion' => 'SACOS', 'sacos' => ['pesadas' => [
            ['sacos' => 1, 'peso_kg' => 48.5], ['sacos' => 1, 'peso_kg' => 51, 'foto_id' => $f2['id']]]]]))
            ->assertStatus(422)->assertJsonValidationErrors('sacos.pesadas.0.foto_id');

        $lote = $this->postJson('/api/cargas/lotes', $this->base(['tipo_recepcion' => 'SACOS', 'sacos' => ['pesadas' => [
            ['sacos' => 1, 'peso_kg' => 48.5, 'foto_id' => $f1['id']],
            ['sacos' => 1, 'peso_kg' => 51, 'foto_id' => $f2['id']],
            ['sacos' => 10, 'peso_kg' => 495.25, 'foto_id' => $f3['id']],    // una tanda de 10
        ]]]))->assertCreated()->json('data');
        $this->reglasDiferidas();

        $p = $lote['pesajes'][0];
        $this->assertSame('SACOS', $p['modalidad']);
        $this->assertSame('BALANZA MANUAL', $p['bascula']);
        $this->assertNull($p['ticket']);
        $this->assertEquals(594.75, (float) $p['peso_neto_kg']);
        $this->assertSame(12, $p['num_sacos']);
        $this->assertCount(3, $p['sacos']);
        $this->assertCount(1, $p['sacos'][2]['fotos']);
        $this->assertNull($p['bono'] ?? null);
        $this->assertEquals(594.75, (float) $lote['peso_neto_humedo_kg']);
    }

    public function test_la_base_rechaza_sacos_que_no_cuadran(): void
    {
        $lote = DB::table('cargas.lote')->insertGetId(['serie_id' => SerieLote::where('prefijo', 'CZP')->value('id'), 'almacen_id' => 1,
            'productor_id' => $this->productor->id, 'registrado_por' => 1, 'linea_producto_id' => 1, 'origen' => 'COMPRA', 'codigo' => 'x']);
        $this->expectExceptionMessage('no cuadra con sus pesadas');
        DB::transaction(function () use ($lote) {
            $p = DB::table('cargas.pesaje')->insertGetId(['lote_id' => $lote, 'modalidad' => 'SACOS', 'bascula' => 'MANUAL',
                'peso_bruto_kg' => 100, 'tara_kg' => 0, 'num_sacos' => 2, 'registrado_por' => 1]);
            DB::table('cargas.pesaje_saco')->insert(['pesaje_id' => $p, 'orden' => 1, 'sacos' => 2, 'peso_kg' => 90]);
            $this->reglasDiferidas();
        });
    }

    // --- Mixta ------------------------------------------------------------------

    public function test_mixta_genera_dos_lotes_y_un_solo_bono_por_el_camion(): void
    {
        $interior = $this->foto('TICKET_INTERIOR');
        $f1 = $this->foto('BALANZA_MANUAL');
        $f2 = $this->foto('BALANZA_MANUAL');
        $pesadas = [['sacos' => 30, 'peso_kg' => 1500, 'foto_id' => $f1['id']], ['sacos' => 20, 'peso_kg' => 1000, 'foto_id' => $f2['id']]];

        // Los sacos no pueden pesar lo mismo o más que el neto del camión.
        $this->postJson('/api/cargas/lotes', $this->base(['tipo_recepcion' => 'MIXTA', 'material' => 'ZN',
            'pesaje' => $this->camion(['tara_kg' => 17500, 'foto_interior_id' => $interior['id']]), 'sacos' => ['pesadas' => $pesadas]]))
            ->assertStatus(422)->assertJsonValidationErrors('sacos.pesadas');

        $r = $this->postJson('/api/cargas/lotes', $this->base(['tipo_recepcion' => 'MIXTA', 'material' => 'ZN',
            'pesaje' => $this->camion(['foto_interior_id' => $interior['id'], 'peso_cliente_kg' => 12100]),
            'sacos' => ['pesadas' => $pesadas], 'lote_sacos' => ['material' => 'PB-AG']]))->assertCreated();
        $granel = $r->json('data');
        $this->reglasDiferidas();
        $this->assertStringContainsString('(granel)', $r->json('mensaje'));

        $this->assertSame('MIXTA', $granel['tipo_recepcion']);
        $this->assertEquals(9500, (float) $granel['pesajes'][0]['peso_neto_kg']);     // 20.000 − 8.000 − 2.500
        $this->assertEquals(9550, (float) $granel['peso_neto_humedo_kg']);            // cliente 9.600: 100 kg más → promedio
        $this->assertSame('PROMEDIO', $granel['pesajes'][0]['criterio_peso']);
        $this->assertEquals(2500, (float) $granel['pesajes'][0]['descuento_sacos_kg']);
        $this->assertEquals(100, (float) $granel['pesajes'][0]['bono']['monto']);      // por 12.000 kg del camión
        $this->assertEquals(9600, (float) $granel['pesajes'][0]['peso_cliente_kg']);   // 12.100 del cliente − 2.500 de sacos

        $sacos = $this->getJson("/api/cargas/lotes/{$granel['lote_par']['id']}")->assertOk()->json('data');
        $this->assertSame($granel['id'], $sacos['lote_par_id']);
        $this->assertSame('PB-AG', $sacos['material']);
        $this->assertEquals(2500, (float) $sacos['peso_neto_humedo_kg']);
        $this->assertSame(50, $sacos['pesajes'][0]['num_sacos']);
        $this->assertSame('CHOFER PRUEBA', $sacos['pesajes'][0]['chofer_nombre']);
        $this->assertSame($granel['pesajes'][0]['id'], $sacos['pesajes'][0]['pesaje_viaje_id']);
        $this->assertSame(1, DB::table('cargas.bono_transporte')->count());

        // Anular el camión anula también los sacos del mismo viaje.
        $this->postJson("/api/cargas/pesajes/{$granel['pesajes'][0]['id']}/anular", ['motivo' => 'Ticket equivocado de otro camión'])->assertOk();
        $this->assertTrue(Pesaje::find($sacos['pesajes'][0]['id'])->anulado);
        $this->reglasDiferidas();
    }

    // --- Datos para identificar la carga --------------------------------------

    public function test_numero_de_orden_y_fecha_de_la_boleta_quedan_en_el_pesaje(): void
    {
        $interior = $this->foto('TICKET_INTERIOR');
        $lote = $this->postJson('/api/cargas/lotes', $this->base(['pesaje' => $this->camion([
            'foto_interior_id' => $interior['id'], 'numero_orden' => ' 458 670 ', 'fecha_ticket' => '2026-10-23T08:18:23'])]))
            ->assertCreated()->json('data');
        $this->assertSame('458670', $lote['pesajes'][0]['numero_orden']);
        $this->assertSame('2026-10-23 08:18:23', \Illuminate\Support\Carbon::parse($lote['pesajes'][0]['fecha_ticket'])->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s'));

        $otra = $this->foto('TICKET_INTERIOR');
        $this->postJson('/api/cargas/lotes', $this->base(['pesaje' => $this->camion([
            'ticket' => '7009', 'foto_interior_id' => $otra['id'], 'fecha_ticket' => now()->addDays(3)->toDateString()])]))
            ->assertStatus(422)->assertJsonValidationErrors('pesaje.fecha_ticket');
    }

    public function test_productores_parecidos_al_nombre_de_la_boleta(): void
    {
        Productor::create(['tipo' => 'PARTICULAR', 'nombre' => 'Rubén Quispe Yapu', 'ci' => '2000002']);
        Productor::create(['tipo' => 'PARTICULAR', 'nombre' => 'Rosa Choque', 'ci' => '3000003']);
        Sanctum::actingAs($this->recepcion);

        $r = $this->getJson('/api/cargas/productores/parecidos?nombre=' . urlencode('QUISPE YAPU RUBEN'))->assertOk()->json('data');
        $this->assertSame('Rubén Quispe Yapu', $r[0]['nombre']);
        $this->assertGreaterThan(0.9, $r[0]['parecido']);
        $this->assertNotContains('Rosa Choque', array_column($r, 'nombre'));
    }

    public function test_lectura_de_nombres_fechas_y_placas(): void
    {
        $ocr = app(OcrTicketService::class);
        $this->assertSame('2026-10-23 08:18:23', $ocr->fechaHora('2026-10-23', '08:18:23'));
        $this->assertSame('2026-10-23 08:34:13', $ocr->fechaHora('23/10/20268:34:13'));
        $this->assertSame('2026-10-23 00:00:00', $ocr->fechaHora('23-10-26'));
        $this->assertNull($ocr->fechaHora('31/02/2026'));
        $this->assertSame('QUISPE YAPU RUBEN', $ocr->nombre('‘QUISPE YAPU RUBEN V'));
        $this->assertSame('1175PFT', $ocr->placa('TI7SPFTC'));
        $this->assertSame('2345KLM', $ocr->placa('2345-KLM'));
    }

    // --- Peso que vale ---------------------------------------------------------

    public function test_peso_que_vale_segun_la_diferencia_con_el_cliente(): void
    {
        DB::table('cargas.parametro')->where('clave', 'FOTO_TICKET_OBLIGATORIA')->update(['valor' => 'NO']);
        Sanctum::actingAs($this->recepcion);
        $casos = [
            // nuestro neto, cliente neto, vale, criterio
            [12000, 11900, 11900, 'CLIENTE'],     // pesamos más: vale el del cliente
            [12000, 11000, 11000, 'CLIENTE'],     // pesamos mucho más: también el del cliente (el menor)
            [12000, 12080, 12040, 'PROMEDIO'],    // pesamos menos, hasta 100 kg: promedio
            [12000, 12300, 12000, 'EMPRESA'],     // pesamos menos por más de 100 kg: vale el nuestro
            [12000, null, 12000, 'EMPRESA'],      // el cliente no declaró
        ];
        foreach ($casos as $i => [$nuestro, $cliente, $vale, $criterio]) {
            $p = $this->postJson('/api/cargas/lotes', $this->base(['pesaje' => $this->camion([
                'ticket' => "PV-{$i}", 'peso_bruto_kg' => $nuestro + 8000, 'tara_kg' => 8000, 'peso_cliente_kg' => $cliente])]))
                ->assertCreated()->json('data');
            $this->assertEquals($vale, (float) $p['pesajes'][0]['peso_final_kg'], "caso {$i}");
            $this->assertSame($criterio, $p['pesajes'][0]['criterio_peso'], "caso {$i}");
            $this->assertEquals($vale, (float) $p['peso_neto_humedo_kg'], "caso {$i}");
        }

        // Corregir el peso del cliente recalcula el peso que vale.
        $id = Pesaje::where('ticket', 'PV-4')->value('id');
        $this->recepcion->givePermissionTo('cargas.recibir');
        $this->postJson("/api/cargas/pesajes/{$id}/peso-cliente", ['peso_cliente_kg' => 12050, 'peso_cliente_tipo' => 'NETO',
            'motivo' => 'El cliente presentó su boleta después'])->assertOk();
        $this->assertEquals(12025, (float) Pesaje::find($id)->peso_final_kg);
        $this->assertSame('PROMEDIO', Pesaje::find($id)->criterio_peso);

        // El límite es un parámetro: con 50 kg, 80 de diferencia ya no promedia.
        DB::table('cargas.parametro')->where('clave', 'LIMITE_PROMEDIO_PESO_KG')->update(['valor' => '50']);
        $p = $this->postJson('/api/cargas/lotes', $this->base(['pesaje' => $this->camion([
            'ticket' => 'PV-9', 'peso_bruto_kg' => 20000, 'tara_kg' => 8000, 'peso_cliente_kg' => 12080])]))->assertCreated()->json('data');
        $this->assertSame('EMPRESA', $p['pesajes'][0]['criterio_peso']);
    }

    // --- Lectura con Claude --------------------------------------------------

    private function respuestaClaude(array $entrada): array
    {
        return ['id' => 'msg_1', 'type' => 'message', 'role' => 'assistant', 'model' => 'claude-sonnet-5-5',
                'content' => [['type' => 'tool_use', 'id' => 'tu_1', 'name' => 'registrar_boleta', 'input' => $entrada]],
                'stop_reason' => 'tool_use', 'usage' => ['input_tokens' => 1650, 'output_tokens' => 210]];
    }

    public function test_lectura_con_claude_llena_los_campos_sin_plantilla(): void
    {
        config(['services.anthropic.key' => 'sk-prueba']);
        Http::fake(['api.anthropic.com/*' => Http::response($this->respuestaClaude([
            'balanza' => 'Victoria', 'ticket' => '0010970', 'numero_orden' => '552', 'peso_bruto_kg' => 18660, 'tara_kg' => 7690,
            'peso_neto_kg' => 10970, 'placa' => '2261-DKE', 'productor' => 'juan  perez', 'chofer' => 'pedro mamani',
            'fecha' => '2026-10-20', 'hora' => '09:15:00', 'dudosos' => ['tara_kg'], 'notas' => null,
        ]))]);

        Sanctum::actingAs($this->recepcion);
        $this->getJson('/api/cargas/opciones')->assertOk()->assertJsonPath('data.lector_claude', true);

        $r = $this->post('/api/cargas/fotos', ['tipo' => 'TICKET_INTERIOR', 'lector' => 'claude',
            'imagen' => UploadedFile::fake()->image('t.jpg', 800, 1100)], ['Accept' => 'application/json'])->assertCreated();
        $r->assertJsonPath('data.bascula', 'VICTORIA')
          ->assertJsonPath('data.lectura.lector', 'claude')
          ->assertJsonPath('data.lectura.campos.ticket.valor', '0010970')
          ->assertJsonPath('data.lectura.campos.peso_neto_kg.valor', 10970)
          ->assertJsonPath('data.lectura.campos.placa.valor', '2261DKE')
          ->assertJsonPath('data.lectura.campos.productor.valor', 'JUAN PEREZ')
          ->assertJsonPath('data.lectura.campos.tara_kg.confianza', 50)
          ->assertJsonPath('data.lectura.coherente', true)
          ->assertJsonPath('data.lectura.uso.entrada', 1650);
        $this->assertArrayNotHasKey('verificado', $r->json('data.lectura.campos.tara_kg'));

        Http::assertSent(fn ($req) => $req->hasHeader('x-api-key', 'sk-prueba')
            && $req['tools'][0]['name'] === 'registrar_boleta' && $req['tool_choice']['type'] === 'auto'
            && $req['messages'][0]['content'][0]['source']['media_type'] === 'image/jpeg');
    }

    public function test_claude_que_contesta_con_texto_json_tambien_se_lee(): void
    {
        config(['services.anthropic.key' => 'sk-prueba']);
        Http::fake(['api.anthropic.com/*' => Http::response(['type' => 'message', 'model' => 'claude-x',
            'content' => [['type' => 'text', 'text' => "Aquí están los datos:\n```json\n{\"ticket\": \"4512\", \"peso_bruto_kg\": 20000, \"tara_kg\": 8000, \"peso_neto_kg\": 12000, \"dudosos\": []}\n```"]],
            'usage' => ['input_tokens' => 10, 'output_tokens' => 5]])]);

        Sanctum::actingAs($this->recepcion);
        $this->post('/api/cargas/fotos', ['tipo' => 'TICKET_INTERIOR', 'lector' => 'claude',
            'imagen' => UploadedFile::fake()->image('t.jpg', 800, 1100)], ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonPath('data.lectura.lector', 'claude')
            ->assertJsonPath('data.lectura.campos.peso_neto_kg.valor', 12000)
            ->assertJsonPath('data.lectura.coherente', true);
    }

    public function test_si_claude_falla_la_foto_se_guarda_y_se_avisa(): void
    {
        config(['services.anthropic.key' => 'sk-prueba']);
        Http::fake(['api.anthropic.com/*' => Http::response(['type' => 'error', 'error' => ['type' => 'billing_error',
            'message' => 'Your credit balance is too low']], 400)]);

        Sanctum::actingAs($this->recepcion);
        $r = $this->post('/api/cargas/fotos', ['tipo' => 'TICKET_INTERIOR', 'lector' => 'claude',
            'imagen' => UploadedFile::fake()->image('t.jpg', 800, 1100)], ['Accept' => 'application/json'])->assertCreated();
        $this->assertStringContainsString('credit balance', $r->json('data.lectura.avisos.0'));
        $this->assertSame([], $r->json('data.lectura.campos'));
    }

    public function test_sin_clave_claude_no_se_ofrece(): void
    {
        config(['services.anthropic.key' => null]);
        Sanctum::actingAs($this->recepcion);
        $this->getJson('/api/cargas/opciones')->assertOk()->assertJsonPath('data.lector_claude', false);
        $this->post('/api/cargas/fotos', ['tipo' => 'BALANZA_MANUAL', 'lector' => 'claude',
            'imagen' => UploadedFile::fake()->image('t.jpg', 600, 800)], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('lector');
    }
}
