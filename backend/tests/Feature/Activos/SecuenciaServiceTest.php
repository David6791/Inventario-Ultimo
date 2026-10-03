<?php

namespace Tests\Feature\Activos;

use App\Modules\Activos\Models\Clase;
use App\Modules\Activos\Models\Subclase;
use App\Modules\Activos\Services\SecuenciaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SecuenciaServiceTest extends TestCase
{
    use RefreshDatabase;

    private SecuenciaService $secuencias;

    protected function setUp(): void
    {
        parent::setUp();
        $this->secuencias = app(SecuenciaService::class);
    }

    public function test_genera_codigos_correlativos_por_subclase(): void
    {
        [$clase, $subclase] = $this->claseYSubclase('05', '02');

        $primero  = $this->secuencias->generarCodigoActivo($clase, $subclase);
        $segundo  = $this->secuencias->generarCodigoActivo($clase, $subclase);

        $this->assertMatchesRegularExpression('/^AF-[A-Z]+-05-02-000001$/', $primero);
        $this->assertMatchesRegularExpression('/^AF-[A-Z]+-05-02-000002$/', $segundo);
    }

    public function test_cada_subclase_lleva_su_propio_correlativo(): void
    {
        [$clase, $portatiles] = $this->claseYSubclase('05', '02');
        $escritorio = Subclase::create([
            'clase_id' => $clase->id, 'codigo' => '01',
            'nombre' => 'Computadoras de escritorio', 'activo' => true,
        ]);

        $this->secuencias->generarCodigoActivo($clase, $portatiles);
        $this->secuencias->generarCodigoActivo($clase, $portatiles);
        $otro = $this->secuencias->generarCodigoActivo($clase, $escritorio);

        // La subclase 01 arranca en 1, no continúa la numeración de la 02.
        $this->assertStringEndsWith('-05-01-000001', $otro);
    }

    public function test_el_correlativo_no_se_reutiliza_tras_un_rollback_de_negocio(): void
    {
        [$clase, $subclase] = $this->claseYSubclase('05', '02');

        $this->secuencias->generarCodigoActivo($clase, $subclase);

        // Simula un alta que falla después de reservar el código.
        try {
            DB::transaction(function () use ($clase, $subclase) {
                $this->secuencias->generarCodigoActivo($clase, $subclase);
                throw new \RuntimeException('el alta falló');
            });
        } catch (\RuntimeException) {
            // esperado
        }

        $siguiente = $this->secuencias->generarCodigoActivo($clase, $subclase);

        // El 2 quedó consumido: se prefiere un hueco antes que un código repetido.
        $this->assertStringEndsWith('-000003', $siguiente);
    }

    public function test_numera_documentos_por_tipo_y_gestion(): void
    {
        $this->assertSame('ASIGNACION-2026-000001', $this->secuencias->generarNumeroDocumento('ASIGNACION', 2026));
        $this->assertSame('ASIGNACION-2026-000002', $this->secuencias->generarNumeroDocumento('ASIGNACION', 2026));
        $this->assertSame('TRASPASO-2026-000001',   $this->secuencias->generarNumeroDocumento('TRASPASO', 2026));
        $this->assertSame('ASIGNACION-2027-000001', $this->secuencias->generarNumeroDocumento('ASIGNACION', 2027));
    }

    /** @return array{0: Clase, 1: Subclase} */
    private function claseYSubclase(string $codigoClase, string $codigoSubclase): array
    {
        $clase = Clase::where('codigo', $codigoClase)->firstOrFail();

        $subclase = Subclase::firstOrCreate(
            ['clase_id' => $clase->id, 'codigo' => $codigoSubclase],
            ['nombre' => 'Subclase de prueba', 'activo' => true]
        );

        return [$clase, $subclase];
    }
}
