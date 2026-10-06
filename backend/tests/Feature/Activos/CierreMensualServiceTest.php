<?php

namespace Tests\Feature\Activos;

use App\Modules\Activos\Models\Activo;
use App\Modules\Activos\Models\Cierre;
use App\Modules\Activos\Models\Clase;
use App\Modules\Activos\Models\PruebaValorRecuperable;
use App\Modules\Activos\Models\Subclase;
use App\Modules\Activos\Models\Ubicacion;
use App\Modules\Activos\Models\Valuacion;
use App\Modules\Activos\Services\AltaService;
use App\Modules\Activos\Services\CierreMensualService;
use App\Modules\Activos\Models\Area;
use App\Modules\Activos\Models\CentroCosto;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use RuntimeException;
use Tests\TestCase;

class CierreMensualServiceTest extends TestCase
{
    use RefreshDatabase;

    private CierreMensualService $cierres;
    private AltaService $altas;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        $this->cierres = app(CierreMensualService::class);
        $this->altas = app(AltaService::class);
    }

    // ───────────────────────────────────────────────── Actualización UFV

    public function test_la_actualizacion_aplica_el_factor_al_valor_de_origen(): void
    {
        // Un bien de 4800 con UFV de 2,00 a 2,10: factor 1,05.
        $activo = $this->activo(valor: 4800, inicioUso: '2026-01-15');

        $cierre = $this->cierres->abrir('2026-01-01', 2.00, 2.10, 1);
        $this->cierres->calcular($cierre, 1);

        $v = $this->valuacion($activo, '2026-01-01', Valuacion::FINANCIERA);

        $this->assertEquals(4800.00, (float) $v->valor_base_inicial);
        $this->assertEquals(240.00, (float) $v->actualizacion);        // 4800 * 0,05
        $this->assertEquals(5040.00, (float) $v->valor_base_final);
    }

    public function test_la_actualizacion_tambien_alcanza_a_la_depreciacion_acumulada(): void
    {
        // Si solo se actualizara el valor y no la acumulada, el neto crecería
        // de forma artificial mes a mes.
        $activo = $this->activo(valor: 4800, inicioUso: '2026-01-15');

        $enero = $this->cierres->abrir('2026-01-01', 2.00, 2.00, 1);
        $this->cierres->calcular($enero, 1);
        $this->cierres->cerrar($enero, 1);

        $febrero = $this->cierres->abrir('2026-02-01', 2.00, 2.10, 1);
        $this->cierres->calcular($febrero, 1);

        $v = $this->valuacion($activo, '2026-02-01', Valuacion::FINANCIERA);

        $this->assertGreaterThan(0, (float) $v->dep_acum_inicial);
        $this->assertGreaterThan(0, (float) $v->dep_actualizacion);
    }

    // ──────────────────────────────────────────────────── Depreciación

    public function test_deprecia_sobre_el_valor_actualizado_no_sobre_el_historico(): void
    {
        // 4800 actualizado a 5040, vida útil 48 meses → 105 por mes.
        // Sobre el histórico daría 100: esa diferencia es el error clásico.
        $activo = $this->activo(valor: 4800, inicioUso: '2026-01-15');

        $cierre = $this->cierres->abrir('2026-01-01', 2.00, 2.10, 1);
        $this->cierres->calcular($cierre, 1);

        $v = $this->valuacion($activo, '2026-01-01', Valuacion::FINANCIERA);

        $this->assertEquals(105.00, (float) $v->dep_periodo);
    }

    public function test_el_mes_de_inicio_de_uso_cuenta_completo(): void
    {
        // Entra en servicio el 28 de enero y depreció el mes entero:
        // DS 24051 Art. 22 computa el mes inicial como completo.
        $activo = $this->activo(valor: 4800, inicioUso: '2026-01-28');

        $cierre = $this->cierres->abrir('2026-01-01', 2.00, 2.00, 1);
        $this->cierres->calcular($cierre, 1);

        $v = $this->valuacion($activo, '2026-01-01', Valuacion::FINANCIERA);

        $this->assertEquals(100.00, (float) $v->dep_periodo);
        $this->assertSame(1, $v->meses_depreciados);
    }

    public function test_no_deprecia_antes_de_entrar_en_servicio(): void
    {
        // Recibido en enero, en servicio recién en marzo.
        $activo = $this->activo(valor: 4800, incorporacion: '2026-01-10', inicioUso: '2026-03-01');

        $cierre = $this->cierres->abrir('2026-01-01', 2.00, 2.00, 1);
        $this->cierres->calcular($cierre, 1);

        $v = $this->valuacion($activo, '2026-01-01', Valuacion::FINANCIERA);

        $this->assertEquals(0.00, (float) $v->dep_periodo);
        $this->assertSame(0, $v->meses_depreciados);
    }

    public function test_un_terreno_no_deprecia(): void
    {
        $terreno = $this->terreno(valor: 100000);

        $cierre = $this->cierres->abrir('2026-01-01', 2.00, 2.10, 1);
        $this->cierres->calcular($cierre, 1);

        $v = $this->valuacion($terreno, '2026-01-01', Valuacion::FINANCIERA);

        // Se actualiza, pero no se deprecia.
        $this->assertEquals(5000.00, (float) $v->actualizacion);
        $this->assertEquals(0.00, (float) $v->dep_periodo);
    }

    public function test_la_acumulada_nunca_supera_el_valor_contabilizado(): void
    {
        // Vida útil de 1 mes: al segundo período no queda nada que depreciar.
        $activo = $this->activo(
            valor: 1200,
            incorporacion: '2026-01-01',
            inicioUso: '2026-01-01',
            vidaEconomica: 1,
            vidaFiscal: 1
        );

        $enero = $this->cierres->abrir('2026-01-01', 2.00, 2.00, 1);
        $this->cierres->calcular($enero, 1);
        $this->cierres->cerrar($enero, 1);

        $febrero = $this->cierres->abrir('2026-02-01', 2.00, 2.00, 1);
        $this->cierres->calcular($febrero, 1);

        $v = $this->valuacion($activo, '2026-02-01', Valuacion::FINANCIERA);

        $this->assertEquals(0.00, (float) $v->dep_periodo);
        $this->assertLessThanOrEqual((float) $v->valor_base_final, (float) $v->dep_acum_final);
    }

    // ──────────────────────────────────────────── Límite valor recuperable

    public function test_el_limite_de_la_nc3_recorta_la_actualizacion(): void
    {
        // Actualizado daría 5040, pero el valor recuperable es 4900.
        $activo = $this->activo(valor: 4800, inicioUso: '2026-01-15');

        PruebaValorRecuperable::create([
            'activo_id'             => $activo->id,
            'periodo'               => '2026-01-01',
            'valor_actualizado_ufv' => 5040,
            'valor_recuperable'     => 4900,
            'valor_adoptado'        => 4900,
            'metodo'                => 'VALOR_MERCADO',
            'registrado_por'        => 1,
        ]);

        $cierre = $this->cierres->abrir('2026-01-01', 2.00, 2.10, 1);
        $this->cierres->calcular($cierre, 1);

        $v = $this->valuacion($activo, '2026-01-01', Valuacion::FINANCIERA);

        $this->assertEquals(-140.00, (float) $v->ajuste_valor_recuperable);
        $this->assertEquals(4900.00, (float) $v->valor_base_final);
    }

    public function test_sin_prueba_registrada_no_se_recorta_nada(): void
    {
        // El ajuste exige respaldo documentado: no se infiere.
        $activo = $this->activo(valor: 4800, inicioUso: '2026-01-15');

        $cierre = $this->cierres->abrir('2026-01-01', 2.00, 2.10, 1);
        $this->cierres->calcular($cierre, 1);

        $v = $this->valuacion($activo, '2026-01-01', Valuacion::FINANCIERA);

        $this->assertEquals(0.00, (float) $v->ajuste_valor_recuperable);
    }

    // ────────────────────────────────────────────────── Series separadas

    public function test_genera_dos_series_por_activo(): void
    {
        $activo = $this->activo(valor: 4800, inicioUso: '2026-01-15');

        $cierre = $this->cierres->abrir('2026-01-01', 2.00, 2.00, 1);
        $this->cierres->calcular($cierre, 1);

        $this->assertDatabaseCount('activos.valuacion', 2);
        $this->assertNotNull($this->valuacion($activo, '2026-01-01', Valuacion::FINANCIERA));
        $this->assertNotNull($this->valuacion($activo, '2026-01-01', Valuacion::IMPOSITIVA));
    }

    public function test_las_series_divergen_cuando_las_vidas_utiles_difieren(): void
    {
        // Económica 60 meses, fiscal 48: la depreciación no coincide.
        $activo = $this->activo(valor: 4800, inicioUso: '2026-01-15',
                                vidaEconomica: 60, vidaFiscal: 48);

        $cierre = $this->cierres->abrir('2026-01-01', 2.00, 2.00, 1);
        $this->cierres->calcular($cierre, 1);

        $f = $this->valuacion($activo, '2026-01-01', Valuacion::FINANCIERA);
        $i = $this->valuacion($activo, '2026-01-01', Valuacion::IMPOSITIVA);

        $this->assertEquals(80.00, (float) $f->dep_periodo);   // 4800 / 60
        $this->assertEquals(100.00, (float) $i->dep_periodo);  // 4800 / 48
        $this->assertNotEquals((float) $f->dep_periodo, (float) $i->dep_periodo);
    }

    // ─────────────────────────────────────────────────── Estados y control

    public function test_no_se_calcula_si_el_periodo_anterior_quedo_abierto(): void
    {
        $this->activo(valor: 4800, inicioUso: '2026-01-15');

        $this->cierres->abrir('2026-01-01', 2.00, 2.00, 1);   // queda ABIERTO

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Ciérrelo');

        $this->cierres->abrir('2026-02-01', 2.00, 2.05, 1);
    }

    public function test_recalcular_borra_el_resultado_anterior(): void
    {
        $this->activo(valor: 4800, inicioUso: '2026-01-15');

        $cierre = $this->cierres->abrir('2026-01-01', 2.00, 2.00, 1);

        $this->cierres->calcular($cierre, 1);
        $this->cierres->calcular($cierre->fresh(), 1);

        // Dos corridas, dos filas: no se acumulan.
        $this->assertDatabaseCount('activos.valuacion', 2);
    }

    public function test_un_periodo_cerrado_no_se_recalcula(): void
    {
        $this->activo(valor: 4800, inicioUso: '2026-01-15');

        $cierre = $this->cierres->abrir('2026-01-01', 2.00, 2.00, 1);
        $this->cierres->calcular($cierre, 1);
        $this->cierres->cerrar($cierre->fresh(), 1);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('cerrado');

        $this->cierres->calcular($cierre->fresh(), 1);
    }

    public function test_un_periodo_cerrado_no_se_reabre(): void
    {
        $this->activo(valor: 4800, inicioUso: '2026-01-15');

        $cierre = $this->cierres->abrir('2026-01-01', 2.00, 2.00, 1);
        $this->cierres->calcular($cierre, 1);
        $this->cierres->cerrar($cierre->fresh(), 1);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('asientos contables');

        $this->cierres->reabrir($cierre->fresh());
    }

    public function test_no_se_cierra_sin_calcular(): void
    {
        $cierre = $this->cierres->abrir('2026-01-01', 2.00, 2.00, 1);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Calcule');

        $this->cierres->cerrar($cierre, 1);
    }

    public function test_el_periodo_siguiente_parte_del_valor_final_del_anterior(): void
    {
        $activo = $this->activo(valor: 4800, inicioUso: '2026-01-15');

        $enero = $this->cierres->abrir('2026-01-01', 2.00, 2.10, 1);
        $this->cierres->calcular($enero, 1);
        $this->cierres->cerrar($enero->fresh(), 1);

        $vEnero = $this->valuacion($activo, '2026-01-01', Valuacion::FINANCIERA);

        $febrero = $this->cierres->abrir('2026-02-01', 2.10, 2.10, 1);
        $this->cierres->calcular($febrero, 1);

        $vFebrero = $this->valuacion($activo, '2026-02-01', Valuacion::FINANCIERA);

        $this->assertEquals(
            (float) $vEnero->valor_base_final,
            (float) $vFebrero->valor_base_inicial
        );
    }

    public function test_los_bienes_de_control_no_se_valuan(): void
    {
        // Van a gasto: no integran el rubro Activo Fijo.
        $activo = $this->activo(valor: 300, inicioUso: '2026-01-15');
        $activo->update(['es_bien_control' => true]);

        $cierre = $this->cierres->abrir('2026-01-01', 2.00, 2.00, 1);
        $this->cierres->calcular($cierre, 1);

        $this->assertDatabaseCount('activos.valuacion', 0);
        $this->assertSame(0, $cierre->fresh()->activos_procesados);
    }

    public function test_los_totales_del_cierre_suman_las_valuaciones(): void
    {
        $this->activo(valor: 4800, inicioUso: '2026-01-15', serie: 'SN-1');
        $this->activo(valor: 2400, inicioUso: '2026-01-15', serie: 'SN-2');

        $cierre = $this->cierres->abrir('2026-01-01', 2.00, 2.10, 1);
        $this->cierres->calcular($cierre, 1);

        $cierre->refresh();

        $this->assertSame(2, $cierre->activos_procesados);
        $this->assertEquals(360.00, (float) $cierre->total_actualizacion);  // 240 + 120
    }

    // ───────────────────────────────────────────────────────── Apoyos

    private function activo(
        float $valor = 4800,
        string $incorporacion = '2026-01-10',
        ?string $inicioUso = null,
        int $vidaEconomica = 48,
        int $vidaFiscal = 48,
        string $serie = 'SN-TEST'
    ): Activo {
        $clase = Clase::where('codigo', '05')->firstOrFail();
        $subclase = Subclase::firstOrCreate(
            ['clase_id' => $clase->id, 'codigo' => '02'],
            ['nombre' => 'Portátiles', 'activo' => true]
        );
        $ubicacion = $this->ubicacionDePrueba();

        return $this->altas->registrar([
            'clase_id' => $clase->id, 'subclase_id' => $subclase->id,
            'denominacion' => 'Equipo', 'serie' => $serie,
            'tipo_origen' => 'COMPRA', 'acta_recepcion_nro' => 'AR-1',
            'fecha_incorporacion' => $incorporacion,
            'fecha_inicio_uso' => $inicioUso,
            'moneda' => 'BOB', 'tipo_cambio' => 1, 'condicion' => 'NUEVO',
            'ubicacion_id' => $ubicacion->id,
            'vida_util_economica_meses' => $vidaEconomica,
            'vida_util_fiscal_meses' => $vidaFiscal,
        ], [['concepto' => 'PRECIO', 'monto' => $valor]], 1);
    }

    private function terreno(float $valor = 100000): Activo
    {
        $clase = Clase::where('codigo', '01')->firstOrFail();
        $subclase = Subclase::firstOrCreate(
            ['clase_id' => $clase->id, 'codigo' => '01'],
            ['nombre' => 'Terreno urbano', 'activo' => true]
        );
        $ubicacion = $this->ubicacionDePrueba();
        return $this->altas->registrar([
            'clase_id' => $clase->id, 'subclase_id' => $subclase->id,
            'denominacion' => 'Terreno', 'serie' => 'TERRENO-1',
            'tipo_origen' => 'COMPRA', 'acta_recepcion_nro' => 'AR-T',
            'fecha_incorporacion' => '2026-01-10',
            'fecha_inicio_uso' => '2026-01-10',
            'moneda' => 'BOB', 'tipo_cambio' => 1, 'condicion' => 'BUENO',
            'ubicacion_id' => $ubicacion->id,
        ], [['concepto' => 'PRECIO', 'monto' => $valor]], 1);
    }

    private function valuacion(Activo $activo, string $periodo, string $tipo): ?Valuacion
    {
        return Valuacion::where('activo_id', $activo->id)
            ->whereDate('periodo', $periodo)
            ->where('tipo', $tipo)
            ->first();
    }
        private function ubicacionDePrueba(): Ubicacion
    {
        $area = Area::firstOrCreate(
            ['codigo' => 'TEST'],
            ['nombre' => 'Área de prueba', 'activo' => true]
        );

        $centro = CentroCosto::firstOrCreate(
            ['codigo' => 'CC-TEST'],
            ['area_id' => $area->id, 'nombre' => 'Centro de prueba', 'activo' => true]
        );

        return Ubicacion::updateOrCreate(
            ['codigo' => 'TEST'],
            [
                'nombre'          => 'Ubicación de prueba',
                'centro_costo_id' => $centro->id,
                'activo'          => true,
            ]
        );
    }
}
