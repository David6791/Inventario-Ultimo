<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\AnularPesajeRequest;
use App\Modules\Cargas\Http\Requests\PesajeRequest;
use App\Modules\Cargas\Models\Lote;
use App\Modules\Cargas\Models\Pesaje;
use App\Modules\Cargas\Services\RecepcionService;
use Illuminate\Http\JsonResponse;

/** Pesajes de un lote: varios camiones por lote, y repesajes de control. */
class PesajeController extends Controller
{
    public function __construct(private readonly RecepcionService $recepcion)
    {
    }

    public function store(PesajeRequest $request, Lote $lote): JsonResponse
    {
        abort_unless($lote->esDelAmbitoDe($request->user()), 403, 'El lote es de una sede a la que su usuario no tiene acceso.');

        $r = $this->recepcion->agregarPesaje($lote, $request->validated(), $request->user());

        return response()->json([
            'data'    => $r['pesaje']->load('bono'),
            'mensaje' => "Pesaje {$r['pesaje']->ticket} registrado: {$r['pesaje']->peso_neto_kg} kg netos."
                . ($r['bono'] ? " Bono: " . self::monto($r['bono']) . "." : ''),
        ], 201);
    }

    public function anular(AnularPesajeRequest $request, Pesaje $pesaje): JsonResponse
    {
        abort_unless($pesaje->lote->esDelAmbitoDe($request->user()), 403, 'El lote es de una sede a la que su usuario no tiene acceso.');

        $pesaje = $this->recepcion->anularPesaje($pesaje, $request->input('motivo'), $request->user());

        return response()->json(['data' => $pesaje->load('bono'), 'mensaje' => "Pesaje {$pesaje->ticket} anulado."]);
    }

    private static function monto(\App\Modules\Cargas\Models\BonoTransporte $bono): string
    {
        return ($bono->moneda === 'USD' ? '$us ' : 'Bs ') . number_format((float) $bono->monto, 2, ',', '.');
    }
}
