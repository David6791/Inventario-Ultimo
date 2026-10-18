<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Importacion\PlantillaProductoresExport;
use App\Modules\Cargas\Importacion\ProductoresImport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

/**
 * Carga masiva de productores (y sus cooperativas) desde Excel, en dos pasos:
 * revisar (no escribe nada) e importar (todo o nada).
 */
class ProductorImportController extends Controller
{
    public function plantilla(Request $request): BinaryFileResponse
    {
        abort_unless($request->user()->can('cargas.catalogos'), 403);

        return Excel::download(new PlantillaProductoresExport, 'plantilla-productores-' . now()->format('Y-m-d') . '.xlsx');
    }

    public function revisar(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('cargas.catalogos'), 403);

        return response()->json($this->resumen($this->leer($request)));
    }

    /**
     * El archivo se vuelve a leer en vez de reusar la revisión: entre un paso
     * y otro alguien pudo registrar un productor con el mismo CI.
     */
    public function importar(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('cargas.catalogos'), 403);

        $importador = $this->leer($request);

        if (! empty($importador->errores)) {
            return response()->json([
                ...$this->resumen($importador),
                'message' => 'No se importó nada: el archivo tiene errores. Corríjalos y vuelva a subirlo.',
            ], 422);
        }

        $resultado = $importador->guardar();

        return response()->json([
            ...$resultado,
            'mensaje' => sprintf(
                'Listo: %d productor(es) nuevo(s), %d actualizado(s) y %d cooperativa(s) creada(s).',
                $resultado['creados'], $resultado['actualizados'], $resultado['cooperativas_creadas']
            ),
        ]);
    }

    private function leer(Request $request): ProductoresImport
    {
        $request->validate([
            'archivo' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120'],
        ], [
            'archivo.required' => 'Elija el archivo Excel con los productores.',
            'archivo.mimes'    => 'El archivo debe ser .xlsx o .xls.',
            'archivo.max'      => 'El archivo no puede superar los 5 MB.',
        ]);

        $importador = new ProductoresImport;

        try {
            Excel::import($importador, $request->file('archivo'));
        } catch (Throwable $e) {
            report($e);
            abort(422, 'No se pudo leer el archivo. Use la plantilla descargada del sistema y conserve la hoja "Productores" con sus títulos.');
        }

        return $importador;
    }

    private function resumen(ProductoresImport $importador): array
    {
        $cooperativas = collect($importador->cooperativas);

        return [
            'nuevos'       => count($importador->paraCrear),
            'actualizados' => count($importador->paraActualizar),
            'errores'      => $importador->errores,
            'advertencias' => $importador->advertencias,
            'cooperativas_nuevas' => $cooperativas->whereNull('id')->pluck('nombre')->values(),
            // Nombres escritos de varias formas que se unificaron en una sola cooperativa.
            'cooperativas_unificadas' => $cooperativas
                ->filter(fn ($c) => ! empty($c['variantes']))
                ->map(fn ($c) => ['nombre' => $c['nombre'], 'variantes' => $c['variantes']])
                ->values(),
            'muestra' => collect([...$importador->paraCrear, ...$importador->paraActualizar])
                ->take(10)
                ->map(fn ($d) => [
                    'fila'        => $d['_fila'],
                    'nombre'      => $d['nombre'],
                    'documento'   => $d['ci'] ?? $d['nit'],
                    'tipo'        => $d['tipo'],
                    'cooperativa' => $d['_cooperativa'] ? $importador->cooperativas[$d['_cooperativa']]['nombre'] : null,
                    'accion'      => isset($d['_id']) ? 'actualiza' : 'nuevo',
                ])
                ->values(),
        ];
    }
}
