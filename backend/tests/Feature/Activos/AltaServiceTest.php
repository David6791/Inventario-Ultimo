<?php

namespace Tests\Feature\Activos;

use App\Modules\Activos\Models\Activo;
use App\Modules\Activos\Models\Clase;
use App\Modules\Activos\Models\Parametro;
use App\Modules\Activos\Models\Subclase;
use App\Modules\Activos\Models\Ubicacion;
use App\Modules\Activos\Services\AltaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use RuntimeException;
use Tests\TestCase;

class AltaServiceTest extends TestCase
{
    use RefreshDatabase;

    private AltaService $altas;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        $this->altas = app(AltaService::class);
    }

    public function test_el_valor_de_origen_es_la_suma_del_desglose(): void
    {
        $activo = $this->alta(costos: [
            ['concepto' => 'PRECIO',      'monto' => 5000],
            ['concepto' => 'FLETE',       'monto' => 300],
            ['concepto' => 'INSTALACION', 'monto' => 200],
        ]);

        $this->assertEquals(5500.00, (float) $activo->valor_origen);
        $this->assertCount(3, $activo->costos);
    }

    public function test_sin_concepto_precio_no_hay_alta(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('PRECIO');

        $this->alta(costos: [['concepto' => 'FLETE', 'monto' => 300]]);
    }

    public function test_hereda_la_vida_util_fiscal_de_la_clase(): void
    {
        // Clase 05, equipos de computación: 48 meses según el Anexo del Art. 22.
        $activo = $this->alta();

        $this->assertSame(48, $activo->vida_util_fiscal_meses);
        $this->assertSame('REGULAR', $activo->regimen_fiscal);
    }

    public function test_el_regimen_ds5563_reduce_la_vida_util_a_la_mitad(): void
    {
        Parametro::where('clave', Parametro::DS5563_ADOPTADO)->update(['valor' => 'true']);
        Cache::flush();

        $activo = $this->alta(datos: ['fecha_incorporacion' => '2026-05-10']);

        $this->assertSame(24, $activo->vida_util_fiscal_meses);
        $this->assertSame('ACELERADO_DS5563', $activo->regimen_fiscal);
    }

    public function test_el_regimen_acelerado_no_alcanza_a_altas_de_otra_gestion(): void
    {
        Parametro::where('clave', Parametro::DS5563_ADOPTADO)->update(['valor' => 'true']);
        Cache::flush();

        $activo = $this->alta(datos: ['fecha_incorporacion' => '2025-05-10']);

        $this->assertSame(48, $activo->vida_util_fiscal_meses);
        $this->assertSame('REGULAR', $activo->regimen_fiscal);
    }

    public function test_un_terreno_no_lleva_vida_util(): void
    {
        $terreno  = Clase::where('codigo', '01')->firstOrFail();
        $subclase = Subclase::firstOrCreate(
            ['clase_id' => $terreno->id, 'codigo' => '01'],
            ['nombre' => 'Terreno urbano', 'activo' => true]
        );

        $activo = $this->alta(datos: [
            'clase_id' => $terreno->id, 'subclase_id' => $subclase->id,
        ]);

        $this->assertNull($activo->vida_util_fiscal_meses);
        $this->assertSame('NO_DEPRECIA', $activo->regimen_fiscal);
    }

    public function test_la_subclase_debe_pertenecer_a_la_clase(): void
    {
        $otraClase = Clase::where('codigo', '08')->firstOrFail();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('no pertenece');

        $this->alta(datos: ['clase_id' => $otraClase->id]);
    }

    public function test_el_inicio_de_uso_no_puede_preceder_a_la_incorporacion(): void
    {
        $this->expectException(RuntimeException::class);

        $this->alta(datos: [
            'fecha_incorporacion' => '2026-06-01',
            'fecha_inicio_uso'    => '2026-05-01',
        ]);
    }

    public function test_el_alta_deja_rastro_en_la_bitacora(): void
    {
        $activo = $this->alta();

        $movimiento = $activo->movimientos()->first();

        $this->assertSame('ALTA', $movimiento->tipo);
        $this->assertSame('REGISTRADO', $movimiento->estado_nuevo);
        $this->assertSame($activo->codigo, $movimiento->detalle['codigo']);
    }

    public function test_dos_altas_de_la_misma_subclase_llevan_correlativos_distintos(): void
    {
        $primero = $this->alta();
        $segundo = $this->alta(datos: ['serie' => 'SN-DISTINTA-002']);

        $this->assertNotSame($primero->codigo, $segundo->codigo);
        $this->assertSame($primero->correlativo + 1, $segundo->correlativo);
    }

    public function test_un_activo_nace_sin_custodio_y_en_estado_registrado(): void
    {
        $activo = $this->alta();

        // La asignación es un acto posterior y documentado (sprint 4).
        $this->assertSame('REGISTRADO', $activo->estado);
        $this->assertNull($activo->custodio_id);
    }

    private function alta(array $datos = [], ?array $costos = null): Activo
    {
        $clase    = Clase::where('codigo', '05')->firstOrFail();
        $subclase = Subclase::firstOrCreate(
            ['clase_id' => $clase->id, 'codigo' => '02'],
            ['nombre' => 'Computadoras portátiles', 'vida_util_economica_meses' => 48, 'activo' => true]
        );
        $ubicacion = Ubicacion::firstOrCreate(
            ['codigo' => 'TEST'],
            ['nombre' => 'Ubicación de prueba', 'activo' => true]
        );

        $base = [
            'clase_id'            => $clase->id,
            'subclase_id'         => $subclase->id,
            'denominacion'        => 'Laptop de prueba',
            'serie'               => 'SN-PRUEBA-001',
            'tipo_origen'         => 'COMPRA',
            'acta_recepcion_nro'  => 'AR-001',
            'fecha_incorporacion' => '2026-03-15',
            'moneda'              => 'BOB',
            'tipo_cambio'         => 1,
            'condicion'           => 'NUEVO',
            'ubicacion_id'        => $ubicacion->id,
        ];

        return $this->altas->registrar(
            array_merge($base, $datos),
            $costos ?? [['concepto' => 'PRECIO', 'monto' => 5000]],
            1
        );
    }
}
