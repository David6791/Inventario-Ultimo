<?php

namespace Tests\Feature\Cargas;

use App\Modules\Cargas\Models\Cooperativa;
use App\Modules\Cargas\Models\Productor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class ImportacionProductoresTest extends TestCase
{
    use ActuaConPermisos;
    use PreparaBaseCargas;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
        $this->actuarCon(['cargas.ver', 'cargas.catalogos']);
    }

    /** Arma un .xlsx con la hoja «Productores» y las filas dadas. */
    private function archivo(array $filas): UploadedFile
    {
        $libro = new Spreadsheet;
        $hoja = $libro->getActiveSheet()->setTitle('Productores');
        $hoja->fromArray([['Tipo', 'Nombre', 'CI', 'NIT', 'NIM', 'Teléfono', 'Domicilio', 'Cooperativa'], ...$filas]);

        $ruta = tempnam(sys_get_temp_dir(), 'prod') . '.xlsx';
        (new Xlsx($libro))->save($ruta);

        return new UploadedFile($ruta, 'productores.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);
    }

    public function test_la_plantilla_se_descarga(): void
    {
        $this->get('/api/cargas/productores/importar/plantilla')->assertOk()->assertDownload();
    }

    public function test_revisar_no_escribe_y_unifica_cooperativas_escritas_distinto(): void
    {
        Cooperativa::create(['nombre' => 'Cerro Rico R.L.']);

        $this->post('/api/cargas/productores/importar/revisar', ['archivo' => $this->archivo([
            ['', 'Juan Pérez', 1234567, '', '', '', '', 'CERRO  RICO R.L.'],
            ['', 'Ana Choque', '7654321', '', '', '', '', 'Huayna Porco R.L.'],
            ['', 'Ana  Choque', '1111', '', '', '', '', 'huayna porco r.l.'],
            ['', 'Comercial X', '', '102030', '', '', '', ''],
        ])], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('nuevos', 4)
            ->assertJsonPath('errores', [])
            ->assertJsonPath('cooperativas_nuevas', ['Huayna Porco R.L.'])
            ->assertJsonPath('cooperativas_unificadas.0.nombre', 'Cerro Rico R.L.')
            ->assertJsonPath('muestra.0.documento', '1234567')
            ->assertJsonPath('muestra.3.tipo', 'PARTICULAR')
            ->assertJsonCount(1, 'advertencias');

        $this->assertSame(0, Productor::count());
    }

    public function test_un_solo_error_y_no_se_importa_nada(): void
    {
        $this->post('/api/cargas/productores/importar', ['archivo' => $this->archivo([
            ['', 'Bien', '1', '', '', '', '', ''],
            ['COOPERATIVISTA', 'Sin cooperativa', '2', '', '', '', '', ''],
            ['', 'Repetido', '1', '', '', '', '', ''],
        ])], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonCount(2, 'errores')
            ->assertJsonPath('errores.0.fila', 3)
            ->assertJsonPath('errores.1.mensaje', 'Este CI ya aparece en la fila 2 del archivo.');

        $this->assertSame(0, Productor::count());
    }

    public function test_importa_crea_cooperativas_y_actualiza_por_ci(): void
    {
        Productor::create(['tipo' => 'PARTICULAR', 'nombre' => 'Nombre viejo', 'ci' => '999']);

        $this->post('/api/cargas/productores/importar', ['archivo' => $this->archivo([
            ['', 'Nombre nuevo', '999', '', '', '70000000', '', ''],
            ['COOPERATIVISTA', 'Socio', '123', '', 'NIM-1', '', '', 'Kunti R.L.'],
        ])], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('creados', 1)
            ->assertJsonPath('actualizados', 1)
            ->assertJsonPath('cooperativas_creadas', 1);

        $this->assertDatabaseHas('cargas.productor', ['ci' => '999', 'nombre' => 'Nombre nuevo', 'telefono' => '70000000']);
        $this->assertSame('Kunti R.L.', Productor::where('ci', '123')->first()->cooperativa->nombre);
    }

    public function test_ci_y_nit_de_productores_distintos_es_un_error(): void
    {
        Productor::create(['tipo' => 'PARTICULAR', 'nombre' => 'A', 'ci' => '1']);
        Productor::create(['tipo' => 'EMPRESA', 'nombre' => 'B', 'nit' => '2']);

        $this->post('/api/cargas/productores/importar/revisar', ['archivo' => $this->archivo([
            ['', 'Mezcla', '1', '2', '', '', '', ''],
        ])], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('errores.0.mensaje', 'El CI corresponde a «A» y el NIT a «B»: son productores distintos.');
    }
}
