<?php

namespace Tests\Feature\Cargas;

use App\Modules\Cargas\Models\Productor;
use App\Modules\Cargas\Models\SerieLote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SeriesLoteApiTest extends TestCase
{
    use ActuaConPermisos;
    use PreparaBaseCargas;
    use RefreshDatabase;

    private const SERIES = ['cargas.ver', 'cargas.series'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
    }

    private function serie(string $prefijo): SerieLote
    {
        return SerieLote::where('prefijo', $prefijo)->firstOrFail();
    }

    private function datos(SerieLote $s, array $cambios = []): array
    {
        return [...$s->only(['prefijo', 'nombre', 'linea_producto_id', 'origen', 'formato', 'reinicio', 'activa']), ...$cambios];
    }

    public function test_la_lista_muestra_el_proximo_codigo_de_cada_serie(): void
    {
        $this->actuarCon(['cargas.ver']);

        $czp = collect($this->getJson('/api/cargas/series')->assertOk()->assertJsonPath('sigla', 'MAC')->json('data'))
            ->firstWhere('prefijo', 'CZP');

        $this->assertSame('CZP-' . now()->format('Ym') . '-0001', $czp['proximo_codigo']);
        $this->assertSame(0, $czp['lotes']);
    }

    public function test_vista_previa_de_un_formato_sin_guardar(): void
    {
        $this->actuarCon(self::SERIES);
        $linea = $this->serie('OXI')->linea_producto_id;

        $this->postJson('/api/cargas/series/vista-previa', [
            'prefijo' => 'nue', 'linea_producto_id' => $linea, 'origen' => 'COMPRA',
            'formato' => '{SIGLA}{ORIGEN}-{AA}-{N:5}', 'reinicio' => 'ANUAL', 'fecha' => '2026-11-05',
        ])->assertOk()->assertJsonPath('data.codigo', 'MACC-26-00001')->assertJsonPath('data.error', null);

        $this->postJson('/api/cargas/series/vista-previa', [
            'prefijo' => 'NUE', 'linea_producto_id' => $linea, 'origen' => 'COMPRA',
            'formato' => '{PREFIJO}-{N:4}', 'reinicio' => 'MENSUAL',
        ])->assertOk()->assertJsonPath('data.codigo', null)
          ->assertJsonPath('data.error', fn ($e) => str_starts_with($e, 'Con reinicio MENSUAL el formato debe mostrar el año y el mes'));
    }

    public function test_crear_una_serie_valida_el_formato(): void
    {
        $this->actuarCon(self::SERIES);
        $linea = $this->serie('OXI')->linea_producto_id;
        $base = ['prefijo' => 'ox2', 'nombre' => 'Oxidados 2', 'linea_producto_id' => $linea, 'origen' => 'COMPRA'];

        $this->postJson('/api/cargas/series', [...$base, 'formato' => 'LOTE {N}', 'reinicio' => 'NUNCA'])
            ->assertStatus(422)->assertJsonValidationErrors('formato');

        $this->postJson('/api/cargas/series', [...$base, 'formato' => '{PREFIJO}/{AAAA}/{N:3}', 'reinicio' => 'ANUAL'])
            ->assertCreated()
            ->assertJsonPath('data.prefijo', 'OX2')
            ->assertJsonPath('data.proximo_codigo', 'OX2/' . now()->year . '/001');
    }

    public function test_con_lotes_el_prefijo_no_cambia_pero_el_formato_si(): void
    {
        $this->actuarCon(self::SERIES);
        $czp = $this->serie('CZP');
        $p = Productor::create(['tipo' => 'PARTICULAR', 'nombre' => 'Uno', 'ci' => '1']);
        $this->crearLote('CZP', $p->id);

        $this->putJson("/api/cargas/series/{$czp->id}", $this->datos($czp, ['prefijo' => 'CZX']))
            ->assertStatus(422)->assertJsonValidationErrors('prefijo');

        $this->putJson("/api/cargas/series/{$czp->id}", $this->datos($czp, ['formato' => '{PREFIJO}{AA}{N:6}', 'reinicio' => 'ANUAL']))
            ->assertOk()
            ->assertJsonPath('data.lotes', 1)
            ->assertJsonPath('data.proximo_codigo', 'CZP' . now()->format('y') . '000001');
    }

    public function test_un_formato_que_repetiria_un_codigo_se_rechaza(): void
    {
        $this->actuarCon(self::SERIES);
        $czp = $this->serie('CZP');
        $p = Productor::create(['tipo' => 'PARTICULAR', 'nombre' => 'Uno', 'ci' => '1']);
        $primero = $this->crearLote('CZP', $p->id);       // CZP-AAAAMM-0001, contador mensual

        // Mismo texto con reinicio anual: el contador anual arranca en 1 y repetiría el código.
        $this->putJson("/api/cargas/series/{$czp->id}", $this->datos($czp, ['reinicio' => 'ANUAL', 'formato' => '{PREFIJO}-{AAAA}' . now()->format('m') . '-{N:4}']))
            ->assertStatus(422)
            ->assertJsonPath('errors.formato.0', "Con este formato el próximo código sería {$primero}, que ya existe. Use un formato distinto.");
    }

    public function test_continuar_la_numeracion_de_otro_sistema(): void
    {
        $this->actuarCon(self::SERIES);
        $ec = $this->serie('OXI');

        $this->putJson("/api/cargas/series/{$ec->id}/contador", ['ultimo_numero' => 4579])
            ->assertOk()
            ->assertJsonPath('data.ultimo_numero', 4579)
            ->assertJsonPath('data.proximo_codigo', 'OXI-' . now()->format('Ym') . '-4580');

        $this->putJson("/api/cargas/series/{$ec->id}/contador", ['ultimo_numero' => 10])
            ->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'el contador no retrocede'));
    }

    public function test_la_sigla_nueva_rige_en_los_proximos_codigos(): void
    {
        $this->actuarCon(self::SERIES);
        $czp = $this->serie('CZP');
        $this->putJson("/api/cargas/series/{$czp->id}", $this->datos($czp, ['formato' => '{SIGLA}-{PREFIJO}-{AAAA}-{N:4}', 'reinicio' => 'ANUAL']))->assertOk();

        $this->putJson('/api/cargas/series/sigla', ['sigla' => 'mgc'])->assertOk()->assertJsonPath('data.sigla', 'MGC');

        $this->getJson("/api/cargas/series/{$czp->id}")->assertJsonPath('data.proximo_codigo', 'MGC-CZP-' . now()->year . '-0001');
    }

    public function test_editar_series_exige_su_propio_permiso(): void
    {
        $this->actuarCon(['cargas.ver', 'cargas.catalogos']);
        $czp = $this->serie('CZP');

        $this->putJson("/api/cargas/series/{$czp->id}", $this->datos($czp))->assertForbidden();
        $this->postJson('/api/cargas/series/vista-previa', ['reinicio' => 'NUNCA'])->assertForbidden();
    }
}
