<?php

namespace Tests\Feature\Activos;

use App\Modules\Activos\Models\Parametro;
use App\Modules\Activos\Services\ParametroService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class ParametroServiceTest extends TestCase
{
    use RefreshDatabase;

    private ParametroService $parametros;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        $this->parametros = app(ParametroService::class);
    }

    public function test_devuelve_el_umbral_sembrado_por_el_ddl(): void
    {
        $this->assertSame(500.0, $this->parametros->umbralCapitalizacionUfv());
    }

    public function test_un_cambio_de_valor_no_altera_el_pasado(): void
    {
        $antes = Carbon::today()->subMonths(2);

        // Reescribe la vigencia inicial para poder cambiarla a una fecha intermedia.
        Parametro::where('clave', Parametro::UMBRAL_UFV)
            ->update(['vigente_desde' => $antes]);
        Cache::flush();

        $corte = Carbon::today()->subMonth();
        $this->parametros->actualizar(Parametro::UMBRAL_UFV, '800', $corte);

        // Antes del corte rige el valor viejo; desde el corte, el nuevo.
        $this->assertSame(500.0, $this->parametros->numero(Parametro::UMBRAL_UFV, $corte->copy()->subDay()));
        $this->assertSame(800.0, $this->parametros->numero(Parametro::UMBRAL_UFV, $corte));
        $this->assertSame(800.0, $this->parametros->numero(Parametro::UMBRAL_UFV, Carbon::today()));
    }

    public function test_la_vigencia_anterior_queda_cerrada_y_no_se_borra(): void
    {
        Parametro::where('clave', Parametro::UMBRAL_UFV)
            ->update(['vigente_desde' => Carbon::today()->subMonths(2)]);
        Cache::flush();

        $corte = Carbon::today()->subMonth();
        $this->parametros->actualizar(Parametro::UMBRAL_UFV, '800', $corte);

        $historial = Parametro::where('clave', Parametro::UMBRAL_UFV)
            ->orderBy('vigente_desde')->get();

        $this->assertCount(2, $historial);
        $this->assertSame('500', $historial[0]->valor);
        $this->assertTrue($historial[0]->vigente_hasta->isSameDay($corte));
        $this->assertNull($historial[1]->vigente_hasta);
    }

    public function test_falla_si_el_parametro_no_existe(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->parametros->valor('PARAMETRO_INEXISTENTE');
    }

    public function test_castea_segun_el_tipo_declarado(): void
    {
        $this->assertIsFloat($this->parametros->valor(Parametro::UMBRAL_UFV));
        $this->assertIsBool($this->parametros->valor(Parametro::DS5563_ADOPTADO));
        $this->assertIsString($this->parametros->valor(Parametro::SIGLA_EMPRESA));
    }
}
