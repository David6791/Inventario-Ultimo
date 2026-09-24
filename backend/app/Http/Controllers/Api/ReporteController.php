<?php

namespace App\Http\Controllers\Api;

use App\Exports\ReporteExport;
use App\Http\Controllers\Controller;
use App\Reportes\FabricaReportes;
use App\Reportes\Reporte;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use InvalidArgumentException;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Los cuatro reportes, en tres formatos.
 *
 * Pantalla, PDF y Excel leen el MISMO objeto `Reporte`: las columnas, las filas
 * y los totales se definen una sola vez. Eso es lo que garantiza que el total
 * impreso no difiera del de la pantalla — el error más difícil de detectar y el
 * más grave en una revisión.
 */
class ReporteController extends Controller
{
    /** Datos para mostrar en pantalla. */
    public function mostrar(Request $request, string $tipo): JsonResponse
    {
        $reporte = $this->resolver($request, $tipo);

        $filas = $reporte->filas();

        return response()->json([
            'titulo'        => $reporte->titulo(),
            'columnas'      => $reporte->columnas(),
            'filas'         => $filas,
            'totales'       => $reporte->totales(),
            'filtros'       => $reporte->filtrosAplicados(),
            'mensaje_vacio' => $reporte->mensajeVacio(),
            'generado_en'   => now()->toIso8601String(),
        ]);
    }

    public function pdf(Request $request, string $tipo): Response
    {
        $reporte = $this->resolver($request, $tipo);

        $pdf = Pdf::loadView('pdf.reportes.generico', [
            'reporte'     => $reporte,
            'columnas'    => $reporte->columnas(),
            'filas'       => $reporte->filas(),
            'totales'     => $reporte->totales(),
            'filtros'     => $reporte->filtrosAplicados(),
            'institucion' => config('app.name'),
        ])->setPaper('letter', $reporte->horizontal() ? 'landscape' : 'portrait');

        return $pdf->stream($reporte->nombreArchivo().'.pdf');
    }

    public function excel(Request $request, string $tipo): BinaryFileResponse
    {
        $reporte = $this->resolver($request, $tipo);

        return Excel::download(
            new ReporteExport($reporte),
            $reporte->nombreArchivo().'.xlsx'
        );
    }

    /**
     * Resuelve el reporte y verifica el permiso.
     *
     * Cada reporte declara cuál necesita, así no hay una lista paralela acá que
     * se pueda desactualizar.
     */
    private function resolver(Request $request, string $tipo): Reporte
    {
        try {
            $reporte = FabricaReportes::crear($tipo, $request);
        } catch (InvalidArgumentException $e) {
            abort(404, $e->getMessage());
        }

        abort_unless($request->user()->can($reporte->permiso()), 403);

        return $reporte;
    }
}
