<?php

namespace Tests\Feature\Comun;

use App\Models\User;
use App\Modules\Comun\Services\EmpresaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View;
use Laravel\Sanctum\Sanctum;
use Tests\Feature\Cargas\PreparaBaseCargas;
use Tests\TestCase;

/** Datos de la empresa: nombre, logo y marca de agua de documentos y reportes. */
class EmpresaApiTest extends TestCase
{
    use PreparaBaseCargas;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->prepararBaseCargas();
        Storage::fake('local');
    }

    public function test_el_nombre_y_el_logo_son_publicos_y_cambiarlos_exige_permiso(): void
    {
        $this->getJson('/api/empresa')->assertOk()->assertJsonPath('data.tiene_logo', false);
        $this->getJson('/api/empresa/logo')->assertNotFound();

        $sinPermiso = User::factory()->create();
        Sanctum::actingAs($sinPermiso);
        $this->postJson('/api/empresa', ['nombre' => 'Otra'])->assertForbidden();

        $admin = User::factory()->create();
        $admin->givePermissionTo('empresa.configurar');
        Sanctum::actingAs($admin->fresh());

        $this->post('/api/empresa', [
            'nombre' => '  Ingenio  Casiano  S.R.L. ', 'subtitulo' => 'NIT 123456 · Potosí',
            'marca_agua_opacidad' => 0.1,
            'logo' => UploadedFile::fake()->image('logo.png', 200, 80),
            'marca_agua' => UploadedFile::fake()->image('marca.png', 400, 400),
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('data.nombre', 'Ingenio Casiano S.R.L.')
            ->assertJsonPath('data.tiene_logo', true)
            ->assertJsonPath('data.tiene_marca', true);

        $this->get('/api/empresa/logo')->assertOk();
        $this->get('/api/empresa/marca-agua')->assertOk();

        // Los PDF reciben el nombre, el logo y la marca de agua como data URI.
        $pdf = app(EmpresaService::class)->paraPdf();
        $this->assertSame('Ingenio Casiano S.R.L.', $pdf['nombre']);
        $this->assertStringStartsWith('data:image/png;base64,', $pdf['logo']);
        $html = View::make('pdf._institucion', ['institucion' => 'lo que diga el controlador'])->render();
        $this->assertStringContainsString('Ingenio Casiano S.R.L.', $html);
        $this->assertStringContainsString('NIT 123456', $html);

        // Quitar el logo.
        $this->post('/api/empresa', ['nombre' => 'Ingenio Casiano S.R.L.', 'quitar_logo' => true], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.tiene_logo', false)->assertJsonPath('data.tiene_marca', true);

        // Solo imágenes.
        $this->post('/api/empresa', ['nombre' => 'X', 'logo' => UploadedFile::fake()->create('logo.pdf', 10, 'application/pdf')],
            ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('logo');
    }
}
