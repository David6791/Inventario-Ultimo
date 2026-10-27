<?php

use App\Modules\Cargas\Http\Controllers\AnalisisController;
use App\Modules\Cargas\Http\Controllers\BancoController;
use App\Modules\Cargas\Http\Controllers\BonoController;
use App\Modules\Cargas\Http\Controllers\LoteController;
use App\Modules\Cargas\Http\Controllers\PesajeController;
use App\Modules\Cargas\Http\Controllers\CooperativaController;
use App\Modules\Cargas\Http\Controllers\CotizacionController;
use App\Modules\Cargas\Http\Controllers\PrecioController;
use App\Modules\Cargas\Http\Controllers\RetencionController;
use App\Modules\Cargas\Http\Controllers\ElementoController;
use App\Modules\Cargas\Http\Controllers\EstadoController;
use App\Modules\Cargas\Http\Controllers\FotoRecepcionController;
use App\Modules\Cargas\Http\Controllers\PlantillaBasculaController;
use App\Modules\Cargas\Http\Controllers\LaboratorioController;
use App\Modules\Cargas\Http\Controllers\LineaProductoController;
use App\Modules\Cargas\Http\Controllers\MinaController;
use App\Modules\Cargas\Http\Controllers\MunicipioController;
use App\Modules\Cargas\Http\Controllers\OpcionesController;
use App\Modules\Cargas\Http\Controllers\ProductorController;
use App\Modules\Cargas\Http\Controllers\ProductorImportController;
use App\Modules\Cargas\Http\Controllers\SerieLoteController;
use App\Modules\Cargas\Http\Controllers\VerificacionLoteController;
use Illuminate\Support\Facades\Route;

/*
| Rutas del módulo de cargas — prefijo api/cargas (CargasServiceProvider).
|
| Recordatorios:
|   - Los segmentos literales van ANTES de {param} (productores/importar antes
|     que productores/{productor}), y todo {param} numérico lleva whereNumber().
|   - Leer exige cargas.ver; escribir lo autoriza cada FormRequest
|     (cargas.catalogos o cargas.series).
*/

// Verificación pública del rótulo (QR): sin sesión, solo con el código aleatorio impreso.
Route::get('verificar/{codigo}', VerificacionLoteController::class)
    ->middleware('throttle:30,1')
    ->where('codigo', '[A-Fa-f0-9]{32}');

Route::middleware('auth:sanctum')->group(function () {

    // --- Lectura ------------------------------------------------------------
    Route::middleware('can:cargas.ver')->group(function () {
        Route::get('estado',   EstadoController::class);
        Route::get('opciones', OpcionesController::class);

        Route::get('productores',             [ProductorController::class, 'index']);
        Route::get('productores/parecidos',   [ProductorController::class, 'parecidos']);
        Route::get('productores/{productor}', [ProductorController::class, 'show'])->whereNumber('productor');

        Route::get('cooperativas',            [CooperativaController::class, 'index']);
        Route::get('minas',                   [MinaController::class, 'index']);
        Route::get('minas/{mina}/bocaminas',  [MinaController::class, 'bocaminas'])->whereNumber('mina');
        Route::get('municipios',              [MunicipioController::class, 'index']);
        Route::get('laboratorios',            [LaboratorioController::class, 'index']);
        Route::get('elementos',               [ElementoController::class, 'index']);
        Route::get('lineas',                  [LineaProductoController::class, 'index']);

        Route::get('series',                  [SerieLoteController::class, 'index']);

        Route::get('lotes',                    [LoteController::class, 'index']);
        Route::get('lotes/{lote}',             [LoteController::class, 'show'])->whereNumber('lote');
        Route::get('lotes/{lote}/boleta',      [LoteController::class, 'boleta'])->whereNumber('lote');
        Route::get('lotes/{lote}/rotulo',      [LoteController::class, 'rotulo'])->whereNumber('lote');
        Route::get('lotes/{lote}/laboratorio', [AnalisisController::class, 'show'])->whereNumber('lote');
        Route::get('lotes/{lote}/valor',       [PrecioController::class, 'valorLote'])->whereNumber('lote');
        Route::get('precios',                  [PrecioController::class, 'index']);
        Route::get('precios/{tabla}',          [PrecioController::class, 'show'])->whereNumber('tabla');
        Route::get('cotizaciones',             [CotizacionController::class, 'index']);
        Route::get('retenciones',              [RetencionController::class, 'index']);
        Route::get('laboratorio/bandeja',      [AnalisisController::class, 'bandeja']);
        Route::get('muestras/{muestra}/etiquetas', [AnalisisController::class, 'etiquetas'])->whereNumber('muestra');
        Route::get('analisis/{analisis}/certificado', [AnalisisController::class, 'certificado'])->whereNumber('analisis');
        Route::get('bono-tramos',              [BonoController::class, 'tramos']);
        Route::get('plantillas-bascula',       [PlantillaBasculaController::class, 'index']);
        Route::get('plantillas-bascula/{plantilla}/muestra', [PlantillaBasculaController::class, 'muestra'])->whereNumber('plantilla');
        Route::get('fotos/{foto}',             [FotoRecepcionController::class, 'imagen'])->whereNumber('foto');
        Route::get('bono-tramos/calcular',     [BonoController::class, 'calcular']);
        Route::get('series/{serie}',          [SerieLoteController::class, 'show'])->whereNumber('serie');
    });

    // Bancos: catálogo compartido; caja también lo lee, por eso basta con estar autenticado.
    Route::get('bancos', [BancoController::class, 'index']);

    // --- Escritura de catálogos (cargas.catalogos, en cada FormRequest) ------
    Route::get('productores/importar/plantilla', [ProductorImportController::class, 'plantilla']);
    Route::post('productores/importar/revisar',  [ProductorImportController::class, 'revisar']);
    Route::post('productores/importar',          [ProductorImportController::class, 'importar']);

    Route::post('productores',               [ProductorController::class, 'store']);
    Route::put('productores/{productor}',    [ProductorController::class, 'update'])->whereNumber('productor');
    Route::delete('productores/{productor}', [ProductorController::class, 'destroy'])->whereNumber('productor')
        ->middleware('can:cargas.catalogos');

    Route::post('cooperativas',                 [CooperativaController::class, 'store']);
    Route::put('cooperativas/{cooperativa}',    [CooperativaController::class, 'update'])->whereNumber('cooperativa');
    Route::delete('cooperativas/{cooperativa}', [CooperativaController::class, 'destroy'])->whereNumber('cooperativa')
        ->middleware('can:cargas.catalogos');

    Route::post('minas',                    [MinaController::class, 'store']);
    Route::put('minas/{mina}',              [MinaController::class, 'update'])->whereNumber('mina');
    Route::delete('minas/{mina}',           [MinaController::class, 'destroy'])->whereNumber('mina')
        ->middleware('can:cargas.catalogos');
    Route::post('minas/{mina}/bocaminas',   [MinaController::class, 'crearBocamina'])->whereNumber('mina');
    Route::put('bocaminas/{bocamina}',      [MinaController::class, 'actualizarBocamina'])->whereNumber('bocamina');

    Route::post('municipios',               [MunicipioController::class, 'store']);
    Route::put('municipios/{municipio}',    [MunicipioController::class, 'update'])->whereNumber('municipio');
    Route::delete('municipios/{municipio}', [MunicipioController::class, 'destroy'])->whereNumber('municipio')
        ->middleware('can:cargas.catalogos');

    Route::post('laboratorios',                 [LaboratorioController::class, 'store']);
    Route::put('laboratorios/{laboratorio}',    [LaboratorioController::class, 'update'])->whereNumber('laboratorio');
    Route::delete('laboratorios/{laboratorio}', [LaboratorioController::class, 'destroy'])->whereNumber('laboratorio')
        ->middleware('can:cargas.catalogos');

    Route::post('bancos',            [BancoController::class, 'store']);
    Route::put('bancos/{banco}',     [BancoController::class, 'update'])->whereNumber('banco');
    Route::delete('bancos/{banco}',  [BancoController::class, 'destroy'])->whereNumber('banco')
        ->middleware('can:cargas.catalogos');

    Route::post('elementos',             [ElementoController::class, 'store']);
    Route::put('elementos/{elemento}',   [ElementoController::class, 'update'])->whereNumber('elemento');

    Route::post('lineas',                [LineaProductoController::class, 'store']);
    Route::put('lineas/{linea}',         [LineaProductoController::class, 'update'])->whereNumber('linea');

    // --- Series de lote (cargas.series) --------------------------------------
    Route::post('series/vista-previa',      [SerieLoteController::class, 'vistaPrevia']);
    Route::put('series/sigla',              [SerieLoteController::class, 'sigla']);
    Route::post('series',                   [SerieLoteController::class, 'store']);
    Route::put('series/{serie}',            [SerieLoteController::class, 'update'])->whereNumber('serie');
    Route::put('series/{serie}/contador',   [SerieLoteController::class, 'contador'])->whereNumber('serie');

    // --- Recepción (cargas.recibir / cargas.anular-lote / cargas.configurar-bono) --
    Route::post('lotes',                        [LoteController::class, 'store']);
    Route::post('lotes/{lote}/anular',          [LoteController::class, 'anular'])->whereNumber('lote');
    Route::post('lotes/{lote}/pesajes',         [PesajeController::class, 'store'])->whereNumber('lote');
    Route::post('pesajes/{pesaje}/anular',      [PesajeController::class, 'anular'])->whereNumber('pesaje');
    Route::post('pesajes/{pesaje}/peso-cliente', [PesajeController::class, 'corregirPesoCliente'])->whereNumber('pesaje');
    Route::put('lotes/{lote}/lectura-estimada', [AnalisisController::class, 'lecturaEstimada'])->whereNumber('lote');
    Route::post('fotos',                        [FotoRecepcionController::class, 'store']);

    // --- Plantillas de báscula (cargas.catalogos) ----------------------------
    Route::post('plantillas-bascula/probar',    [PlantillaBasculaController::class, 'probar']);
    Route::post('plantillas-bascula',           [PlantillaBasculaController::class, 'store']);
    Route::post('plantillas-bascula/{plantilla}', [PlantillaBasculaController::class, 'update'])->whereNumber('plantilla');

    // --- Precios, cotizaciones y retenciones (permisos en FormRequest o controlador)
    Route::post('precios',                    [PrecioController::class, 'store']);
    Route::put('precios/{tabla}',             [PrecioController::class, 'update'])->whereNumber('tabla');
    Route::delete('precios/{tabla}',          [PrecioController::class, 'destroy'])->whereNumber('tabla');
    Route::post('precios/{tabla}/copiar',     [PrecioController::class, 'copiar'])->whereNumber('tabla');
    Route::post('precios/{tabla}/aprobar',    [PrecioController::class, 'aprobar'])->whereNumber('tabla');
    Route::post('precios/{tabla}/anular',     [PrecioController::class, 'anular'])->whereNumber('tabla');
    Route::post('cotizaciones',               [CotizacionController::class, 'store']);
    Route::put('cotizaciones/{cotizacion}',   [CotizacionController::class, 'update'])->whereNumber('cotizacion');
    Route::delete('cotizaciones/{cotizacion}', [CotizacionController::class, 'destroy'])->whereNumber('cotizacion');
    Route::post('retenciones/tasas',          [RetencionController::class, 'publicar']);

    // --- Laboratorio (permisos en cada FormRequest o en el controlador) -----
    Route::post('lotes/{lote}/muestras',              [AnalisisController::class, 'registrarMuestra'])->whereNumber('lote');
    Route::post('muestras/{muestra}/analisis',        [AnalisisController::class, 'registrarAnalisis'])->whereNumber('muestra');
    Route::post('analisis/{analisis}/certificado',    [AnalisisController::class, 'adjuntarCertificado'])->whereNumber('analisis');
    Route::post('analisis/{analisis}/anular',         [AnalisisController::class, 'anularAnalisis'])->whereNumber('analisis');
    Route::put('lotes/{lote}/leyes/{elemento}',       [AnalisisController::class, 'fijarLey'])->whereNumber(['lote', 'elemento']);
    Route::delete('lotes/{lote}/leyes/{elemento}',    [AnalisisController::class, 'quitarLey'])->whereNumber(['lote', 'elemento']);
    Route::post('lotes/{lote}/cerrar-analisis',       [AnalisisController::class, 'cerrar'])->whereNumber('lote');
    Route::post('lotes/{lote}/reabrir',               [AnalisisController::class, 'reabrir'])->whereNumber('lote');
    Route::post('bono-tramos',                  [BonoController::class, 'publicar']);

    // --- Pago de bonos por caja (caja.pagar-bono) ---------------------------
    Route::get('bonos/pendientes',              [BonoController::class, 'pendientes'])->middleware('can:caja.pagar-bono');
    Route::post('bonos/{bono}/pagar',           [BonoController::class, 'pagar'])->whereNumber('bono');
});
