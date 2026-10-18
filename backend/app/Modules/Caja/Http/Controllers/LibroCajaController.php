<?php

namespace App\Modules\Caja\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Caja\Http\Requests\LibroCajaRequest;
use App\Modules\Caja\Reportes\LibroCaja;
use App\Modules\Caja\Reportes\LibroCajaExport;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\Response;

/** Libro de caja por rango de fechas y concepto: en pantalla, PDF y Excel. */
class LibroCajaController extends Controller
{
    public function index(LibroCajaRequest $request): JsonResponse
    {
        $libro = new LibroCaja($request->validated(), $request->user());

        return response()->json(['data' => [
            'titulo'       => $libro->titulo(),
            'totales'      => $libro->totales,
            'por_concepto' => $libro->porConcepto,
            'movimientos'  => $libro->filas(),
        ]]);
    }

    public function pdf(LibroCajaRequest $request): Response
    {
        $libro = new LibroCaja($request->validated(), $request->user());

        return Pdf::loadView('pdf.caja.libro', ['libro' => $libro, 'institucion' => config('app.name')])
            ->setPaper('letter', 'landscape')
            ->stream('libro-de-caja.pdf');
    }

    public function excel(LibroCajaRequest $request): Response
    {
        $libro = new LibroCaja($request->validated(), $request->user());
        $nombre = 'libro-de-caja-' . $request->input('desde') . '-a-' . $request->input('hasta') . '.xlsx';

        return Excel::download(new LibroCajaExport($libro, config('app.name')), $nombre);
    }
}
