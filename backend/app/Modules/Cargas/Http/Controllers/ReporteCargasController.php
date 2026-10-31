<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Reportes\ResumenCargas;
use App\Modules\Cargas\Reportes\ResumenCargasExport;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\Response;

/** Clasificación de la carga recibida: resumen por acopio, tipo, material y origen; tablero, PDF y Excel. */
class ReporteCargasController extends Controller
{
    public function resumen(Request $request): JsonResponse
    {
        $r = new ResumenCargas($this->filtros($request), $request->user());

        return response()->json(['data' => $r->datos]);
    }

    public function pdf(Request $request): Response
    {
        $r = new ResumenCargas($this->filtros($request), $request->user());

        return Pdf::loadView('pdf.cargas.resumen-cargas', ['r' => $r, 'institucion' => config('app.empresa')])
            ->setPaper('letter')->stream('resumen-de-cargas.pdf');
    }

    public function excel(Request $request): Response
    {
        $f = $this->filtros($request);

        return Excel::download(new ResumenCargasExport(new ResumenCargas($f, $request->user()), (string) config('app.empresa')),
            "resumen-de-cargas-{$f['desde']}-a-{$f['hasta']}.xlsx");
    }

    private function filtros(Request $request): array
    {
        return $request->validate([
            'desde'      => ['required', 'date'],
            'hasta'      => ['required', 'date', 'after_or_equal:desde'],
            'almacen_id' => ['nullable', 'integer'],
            'origen'     => ['nullable', 'in:COMPRA,PROPIA'],
            'serie_id'   => ['nullable', 'integer'],
            'material'   => ['nullable', 'string', 'max:10'],
        ], ['hasta.after_or_equal' => 'La fecha final no puede ser anterior a la inicial.']);
    }
}
