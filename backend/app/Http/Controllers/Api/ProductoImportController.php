<?php

namespace App\Http\Controllers\Api;

use App\Exports\PlantillaProductosExport;
use App\Http\Controllers\Controller;
use App\Imports\ProductosImport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

/**
 * Carga masiva de productos desde Excel.
 *
 * Dos pasos: primero se revisa el archivo y se muestra qué va a pasar; recién
 * después se confirma. Nadie debería descubrir lo que cargó después de
 * cargarlo.
 */
class ProductoImportController extends Controller
{
    /** La plantilla, con las categorías y unidades actuales incluidas. */
    public function plantilla(Request $request): BinaryFileResponse
    {
        abort_unless($request->user()->can('productos.crear'), 403);

        return Excel::download(
            new PlantillaProductosExport,
            'plantilla-productos-'.now()->format('Y-m-d').'.xlsx'
        );
    }

    /**
     * Revisa el archivo sin escribir nada.
     *
     * Devuelve cuántos productos entrarían, cuántos se actualizarían y todos
     * los errores encontrados, con su número de fila.
     */
    public function revisar(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('productos.crear'), 403);

        $importador = $this->leer($request);

        return response()->json($this->resumen($importador));
    }

    /**
     * Importa. Falla entera si hay un solo error.
     *
     * El archivo se vuelve a leer en vez de guardar el resultado de la
     * revisión: entre un paso y otro alguien pudo crear un producto con el
     * mismo nombre, y validar contra una foto vieja dejaría pasar el choque.
     */
    public function importar(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('productos.crear'), 403);

        $importador = $this->leer($request);

        if (! empty($importador->errores)) {
            return response()->json([
                ...$this->resumen($importador),
                'mensaje' => 'No se importó nada: el archivo tiene errores. Corríjalos y vuelva a subirlo.',
            ], 422);
        }

        try {
            $resultado = $importador->guardar();
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'mensaje' => 'No se pudo completar la importación. No se guardó ningún producto.',
                'detalle' => $e->getMessage(),
            ], 500);
        }

        return response()->json([
            'creados'      => $resultado['creados'],
            'actualizados' => $resultado['actualizados'],
            'mensaje'      => $this->mensajeExito($resultado),
        ]);
    }

    private function leer(Request $request): ProductosImport
    {
        $request->validate([
            'archivo' => ['required', 'file', 'mimes:xlsx,xls', 'max:5120'],
        ], [
            'archivo.required' => 'Elija el archivo Excel con los productos.',
            'archivo.mimes'    => 'El archivo debe ser .xlsx o .xls. Si lo guardó como CSV, vuelva a guardarlo como Excel.',
            'archivo.max'      => 'El archivo no puede superar los 5 MB.',
        ]);

        $importador = new ProductosImport;

        try {
            Excel::import($importador, $request->file('archivo'));
        } catch (Throwable $e) {
            report($e);

            abort(422, 'No se pudo leer el archivo. Verifique que sea la plantilla descargada '
                     .'desde el sistema y que la hoja "Productos" conserve sus títulos.');
        }

        return $importador;
    }

    private function resumen(ProductosImport $importador): array
    {
        return [
            'validos'      => count($importador->paraCrear) + count($importador->paraActualizar),
            'nuevos'       => count($importador->paraCrear),
            'actualizados' => count($importador->paraActualizar),
            'errores'      => $importador->errores,
            // Vista previa: ver los primeros diez da confianza de que las
            // columnas se leyeron donde corresponde.
            'muestra'      => collect([...$importador->paraCrear, ...$importador->paraActualizar])
                ->take(10)
                ->map(fn ($d) => [
                    'fila'      => $d['_fila'],
                    'codigo'    => $d['codigo'] ?? '(se genera)',
                    'nombre'    => $d['nombre'],
                    'categoria' => $d['_categoria_codigo'],
                    'accion'    => isset($d['_id']) ? 'actualiza' : 'nuevo',
                ])
                ->values(),
        ];
    }

    private function mensajeExito(array $resultado): string
    {
        $partes = [];

        if ($resultado['creados'] > 0) {
            $partes[] = $resultado['creados'] === 1
                ? 'Se registró 1 producto nuevo'
                : "Se registraron {$resultado['creados']} productos nuevos";
        }

        if ($resultado['actualizados'] > 0) {
            $partes[] = $resultado['actualizados'] === 1
                ? 'se actualizó 1 existente'
                : "se actualizaron {$resultado['actualizados']} existentes";
        }

        return empty($partes) ? 'No había nada que importar.' : implode(' y ', $partes).'.';
    }
}
