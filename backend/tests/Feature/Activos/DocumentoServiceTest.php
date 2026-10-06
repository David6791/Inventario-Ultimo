<?php

namespace Tests\Feature\Activos;

use App\Modules\Activos\Models\Activo;
use App\Modules\Activos\Models\Area;
use App\Modules\Activos\Models\CentroCosto;
use App\Modules\Activos\Models\Clase;
use App\Modules\Activos\Models\Documento;
use App\Modules\Activos\Models\Empleado;
use App\Modules\Activos\Models\Subclase;
use App\Modules\Activos\Models\Ubicacion;
use App\Modules\Activos\Services\AltaService;
use App\Modules\Activos\Services\DocumentoService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use RuntimeException;
use Tests\TestCase;

class DocumentoServiceTest extends TestCase
{
    use RefreshDatabase;

    private DocumentoService $documentos;
    private AltaService $altas;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        $this->documentos = app(DocumentoService::class);
        $this->altas = app(AltaService::class);
    }

    // ───────────────────────────────────────────────────────── Asignación

    public function test_un_borrador_no_afecta_al_activo(): void
    {
        $activo = $this->activo();

        $this->documentos->emitir('ASIGNACION',
            ['custodio_destino_id' => $this->empleado()->id], [$activo->id], 1);

        $activo->refresh();

        // El documento existe pero el bien sigue como estaba: esa es la razón
        // de ser del estado BORRADOR.
        $this->assertNull($activo->custodio_id);
        $this->assertSame('REGISTRADO', $activo->estado);
    }

    public function test_confirmar_una_asignacion_pone_el_bien_en_uso(): void
    {
        $activo = $this->activo();
        $empleado = $this->empleado();

        $doc = $this->documentos->emitir('ASIGNACION',
            ['custodio_destino_id' => $empleado->id], [$activo->id], 1);

        $this->documentos->confirmar($doc, 1);

        $activo->refresh();

        $this->assertSame($empleado->id, $activo->custodio_id);
        $this->assertSame('EN_USO', $activo->estado);
    }

    public function test_el_custodio_es_un_empleado_no_un_usuario(): void
    {
        // Un operario recibe herramientas sin tener cuenta en el sistema.
        $activo = $this->activo();
        $empleado = $this->empleado('EMP-SIN-ACCESO');

        $this->assertNull($empleado->user_id);
        $this->assertFalse($empleado->tieneAcceso());

        $doc = $this->documentos->emitir('ASIGNACION',
            ['custodio_destino_id' => $empleado->id], [$activo->id], 1);

        $this->documentos->confirmar($doc, 1);

        $this->assertSame($empleado->id, $activo->refresh()->custodio_id);
    }

    public function test_no_se_asigna_un_bien_que_ya_tiene_custodio(): void
    {
        $activo = $this->activoAsignado();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('traspaso');

        $this->documentos->emitir('ASIGNACION',
            ['custodio_destino_id' => $this->empleado('EMP-B')->id], [$activo->id], 1);
    }

    public function test_la_asignacion_exige_custodio(): void
    {
        $activo = $this->activo();

        $this->expectException(RuntimeException::class);

        $this->documentos->emitir('ASIGNACION', [], [$activo->id], 1);
    }

    // ────────────────────────────────────────────────────────── Traspaso

    public function test_el_traspaso_cambia_de_custodio(): void
    {
        $activo = $this->activoAsignado();
        $nuevo = $this->empleado('EMP-B');

        $doc = $this->documentos->emitir('TRASPASO',
            ['custodio_destino_id' => $nuevo->id], [$activo->id], 1);

        $this->documentos->confirmar($doc, 1);

        $this->assertSame($nuevo->id, $activo->refresh()->custodio_id);
    }

    public function test_no_se_traspasa_un_bien_sin_custodio(): void
    {
        $activo = $this->activo();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('asignación');

        $this->documentos->emitir('TRASPASO',
            ['custodio_destino_id' => $this->empleado('EMP-B')->id], [$activo->id], 1);
    }

    public function test_el_traspaso_debe_cambiar_algo(): void
    {
        $activo = $this->activoAsignado();

        $this->expectException(RuntimeException::class);

        $this->documentos->emitir('TRASPASO', [], [$activo->id], 1);
    }

    // ─────────────────────────────────────────────────── Salida temporal

    public function test_la_salida_temporal_exige_fecha_de_retorno_futura(): void
    {
        $activo = $this->activoAsignado();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('retorno');

        $this->documentos->emitir('SALIDA_TEMPORAL', [
            'destino_externo' => 'Domicilio',
            'fecha_retorno_comprometida' => now()->subDay(),
        ], [$activo->id], 1);
    }

    public function test_el_retorno_devuelve_el_bien_a_en_uso(): void
    {
        $activo = $this->activoAsignado();

        $doc = $this->documentos->emitir('SALIDA_TEMPORAL', [
            'destino_externo' => 'Trabajo remoto',
            'fecha_retorno_comprometida' => now()->addDays(30)->toDateString(),
        ], [$activo->id], 1);

        $this->documentos->confirmar($doc, 1);
        $this->assertSame('FUERA_DE_INSTALACION', $activo->refresh()->estado);

        $this->documentos->registrarRetorno($doc, 1);
        $this->assertSame('EN_USO', $activo->refresh()->estado);
    }

    // ──────────────────────────────────────────────────────── Devolución

    public function test_la_devolucion_libera_al_custodio(): void
    {
        $activo = $this->activoAsignado();

        $doc = $this->documentos->emitir('DEVOLUCION', [], [$activo->id], 1);
        $this->documentos->confirmar($doc, 1);

        $activo->refresh();

        // Sin custodio y disponible: es lo que habilita el descargo laboral.
        $this->assertNull($activo->custodio_id);
        $this->assertSame('REGISTRADO', $activo->estado);
    }

    // ───────────────────────────────────────────────────────── Anulación

    public function test_anular_revierte_al_estado_anterior_exacto(): void
    {
        $primero = $this->empleado('EMP-A');
        $segundo = $this->empleado('EMP-B');

        $activo = $this->activoAsignado();        // queda con EMP-A

        $doc = $this->documentos->emitir('TRASPASO',
            ['custodio_destino_id' => $segundo->id], [$activo->id], 1);

        $this->documentos->confirmar($doc, 1);
        $this->assertSame($segundo->id, $activo->refresh()->custodio_id);

        $this->documentos->anular($doc, 'Traspaso cargado por error', 1);

        // Vuelve al custodio original, reconstruido desde la bitácora y no
        // supuesto: por eso acierta aunque el bien haya pasado por varias
        // manos.
        $this->assertSame($primero->id, $activo->refresh()->custodio_id);
        $this->assertSame(Documento::ANULADO, $doc->refresh()->estado);
    }

    public function test_la_anulacion_deja_rastro_y_no_borra_el_documento(): void
    {
        $activo = $this->activoAsignado();

        $doc = $this->documentos->emitir('TRASPASO',
            ['custodio_destino_id' => $this->empleado('EMP-B')->id], [$activo->id], 1);

        $this->documentos->confirmar($doc, 1);
        $this->documentos->anular($doc, 'Error de carga', 1);

        $this->assertDatabaseHas('activos.documento', [
            'id' => $doc->id, 'estado' => 'ANULADO', 'motivo_anulacion' => 'Error de carga',
        ]);

        // Dos movimientos: el original y su reversión.
        $this->assertCount(2, $activo->movimientos()->where('documento_id', $doc->id)->get());
    }

    public function test_un_borrador_no_se_anula(): void
    {
        $activo = $this->activo();

        $doc = $this->documentos->emitir('ASIGNACION',
            ['custodio_destino_id' => $this->empleado()->id], [$activo->id], 1);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('descarta');

        $this->documentos->anular($doc, 'Motivo cualquiera', 1);
    }

    public function test_no_se_confirma_dos_veces(): void
    {
        $activo = $this->activo();

        $doc = $this->documentos->emitir('ASIGNACION',
            ['custodio_destino_id' => $this->empleado()->id], [$activo->id], 1);

        $this->documentos->confirmar($doc, 1);

        $this->expectException(RuntimeException::class);
        $this->documentos->confirmar($doc->fresh(), 1);
    }

    // ────────────────────────────────────────────────────────── Generales

    public function test_un_bien_dado_de_baja_no_admite_movimientos(): void
    {
        $activo = $this->activo();
        $activo->update([
            'estado'      => 'DADO_DE_BAJA',
            'fecha_baja'  => now()->toDateString(),
            'causal_baja' => 'VENTA',
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('dado de baja');

        $this->documentos->emitir('ASIGNACION',
            ['custodio_destino_id' => $this->empleado()->id], [$activo->id], 1);
    }

    public function test_el_documento_numera_por_tipo_y_gestion(): void
    {
        $a1 = $this->activo('SN-A');
        $a2 = $this->activo('SN-B');
        $empleado = $this->empleado();

        $d1 = $this->documentos->emitir('ASIGNACION',
            ['custodio_destino_id' => $empleado->id], [$a1->id], 1);
        $d2 = $this->documentos->emitir('ASIGNACION',
            ['custodio_destino_id' => $empleado->id], [$a2->id], 1);

        $this->assertStringEndsWith('-000001', $d1->numero);
        $this->assertStringEndsWith('-000002', $d2->numero);
        $this->assertStringStartsWith('ASIGNACION-', $d1->numero);
    }

    public function test_un_documento_puede_llevar_varios_activos(): void
    {
        $a1 = $this->activo('SN-1');
        $a2 = $this->activo('SN-2');
        $empleado = $this->empleado();

        $doc = $this->documentos->emitir('ASIGNACION',
            ['custodio_destino_id' => $empleado->id], [$a1->id, $a2->id], 1);

        $this->documentos->confirmar($doc, 1);

        $this->assertSame($empleado->id, $a1->refresh()->custodio_id);
        $this->assertSame($empleado->id, $a2->refresh()->custodio_id);
        $this->assertCount(2, $doc->fresh()->detalles);
    }

    // ─────────────────────────────────────────────────────────── Apoyos

    private function activo(string $serie = 'SN-TEST-001'): Activo
    {
        $clase = Clase::where('codigo', '05')->firstOrFail();

        $subclase = Subclase::firstOrCreate(
            ['clase_id' => $clase->id, 'codigo' => '02'],
            ['nombre' => 'Portátiles', 'vida_util_economica_meses' => 48, 'activo' => true]
        );

        $ubicacion = $this->ubicacionDePrueba();

        return $this->altas->registrar([
            'clase_id' => $clase->id, 'subclase_id' => $subclase->id,
            'denominacion' => 'Equipo de prueba', 'serie' => $serie,
            'tipo_origen' => 'COMPRA', 'acta_recepcion_nro' => 'AR-1',
            'fecha_incorporacion' => '2026-03-15', 'moneda' => 'BOB',
            'tipo_cambio' => 1, 'condicion' => 'NUEVO', 'ubicacion_id' => $ubicacion->id,
        ], [['concepto' => 'PRECIO', 'monto' => 5000]], 1);
    }

    private function activoAsignado(string $serie = 'SN-ASIG-001'): Activo
    {
        $activo = $this->activo($serie);

        $doc = $this->documentos->emitir('ASIGNACION',
            ['custodio_destino_id' => $this->empleado('EMP-A')->id], [$activo->id], 1);

        $this->documentos->confirmar($doc, 1);

        return $activo->refresh();
    }

    /**
     * Ubicación con su cadena organizativa completa.
     *
     * El alta deriva el centro de costo de la ubicación, así que una ubicación
     * suelta no sirve: el bien quedaría sin centro y fuera de todo ámbito.
     */
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

        return Ubicacion::firstOrCreate(
            ['codigo' => 'TEST'],
            [
                'nombre'          => 'Ubicación de prueba',
                'centro_costo_id' => $centro->id,
                'activo'          => true,
            ]
        );
    }

    /**
     * Personal al que asignarle bienes.
     *
     * El custodio dejó de ser un usuario del sistema: ahora es un empleado,
     * que es quien efectivamente recibe y responde por los bienes. La mayoría
     * no tiene cuenta, y por eso estos empleados se crean sin `user_id`.
     */
    private function empleado(string $codigo = 'EMP-A'): Empleado
    {
        $ubicacion = $this->ubicacionDePrueba();

        return Empleado::firstOrCreate(
            ['codigo' => $codigo],
            [
                'nombres'          => 'Persona',
                'apellido_paterno' => $codigo,
                'ci'               => '90' . substr(md5($codigo), 0, 5),
                'cargo'            => 'Operario',
                'centro_costo_id'  => $ubicacion->centro_costo_id,
                'activo'           => true,
            ]
        );
    }
}