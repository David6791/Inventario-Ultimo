<?php

namespace App\Modules\Caja\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Caja\Http\Requests\AnularMovimientoRequest;
use App\Modules\Caja\Http\Requests\MovimientoRequest;
use App\Modules\Caja\Models\Movimiento;
use App\Modules\Caja\Models\Sesion;
use App\Modules\Caja\Services\CajaService;
use App\Modules\Comun\Support\MontoEnLetras;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/** Ingresos y egresos manuales, su anulación y su comprobante impreso. */
class MovimientoController extends Controller
{
    use AmbitoDeCaja;

    private const RELACIONES = [
        'concepto:id,codigo,nombre,tipo,origen', 'banco:id,nombre',
        'registradoPor:id,name', 'anuladoPor:id,name', 'persona:id,nombre,ci',
    ];

    public function __construct(private readonly CajaService $cajas)
    {
    }

    public function store(MovimientoRequest $request, Sesion $sesion): JsonResponse
    {
        $this->asegurarCajero($sesion->caja);

        $movimiento = $this->cajas->registrar($sesion, $request->user(), $request->validated());

        return response()->json([
            'data'    => $movimiento->load(self::RELACIONES),
            'saldos'  => $this->cajas->resumen($sesion),
            'mensaje' => "Comprobante {$movimiento->numero} registrado.",
        ], 201);
    }

    public function anular(AnularMovimientoRequest $request, Movimiento $movimiento): JsonResponse
    {
        $this->asegurarCajero($movimiento->caja);

        $movimiento = $this->cajas->anular($movimiento, $request->user(), $request->input('motivo'));

        return response()->json([
            'data'    => $movimiento->load(self::RELACIONES),
            'saldos'  => $this->cajas->resumen($movimiento->sesion),
            'mensaje' => "Comprobante {$movimiento->numero} anulado.",
        ]);
    }

    /** Comprobante en PDF para firmar. Un comprobante anulado sale marcado como tal. */
    public function comprobante(Movimiento $movimiento): Response
    {
        $this->asegurarAmbito($movimiento->caja);

        $movimiento->load([...self::RELACIONES, 'caja.almacen:id,nombre', 'sesion:id,numero']);

        return Pdf::loadView('pdf.caja.comprobante', [
            'mov'         => $movimiento,
            'enLetras'    => MontoEnLetras::convertir($movimiento->monto, $movimiento->moneda),
            'institucion' => config('app.empresa'),
        ])->setPaper('letter')->stream("{$movimiento->numero}.pdf");
    }
}
