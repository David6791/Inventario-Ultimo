<?php

namespace App\Modules\Caja\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Caja\Http\Requests\AbrirSesionRequest;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Sesion;
use App\Modules\Caja\Services\CajaService;
use Illuminate\Http\JsonResponse;

/** Sesiones de caja: apertura e historial. El cierre llega en el sprint 3. */
class SesionController extends Controller
{
    use AmbitoDeCaja;

    public function __construct(private readonly CajaService $cajas)
    {
    }

    public function index(Caja $caja): JsonResponse
    {
        $this->asegurarAmbito($caja);

        $sesiones = $caja->sesiones()
            ->with(['abiertaPor:id,name', 'cerradaPor:id,name', 'saldos'])
            ->orderByDesc('numero')
            ->paginate(20);

        return response()->json($sesiones);
    }

    public function store(AbrirSesionRequest $request, Caja $caja): JsonResponse
    {
        $this->asegurarAmbito($caja);

        $sesion = $this->cajas->abrir($caja, $request->user(), $request->input('saldo_inicial', []));

        return response()->json([
            'data'    => [...$sesion->toArray(), 'saldos' => $this->cajas->resumen($sesion)],
            'mensaje' => "Caja {$caja->codigo} abierta: sesión {$sesion->numero}.",
        ], 201);
    }

    public function show(Sesion $sesion): JsonResponse
    {
        $this->asegurarAmbito($sesion->caja);

        return response()->json(['data' => [
            ...$sesion->load(['caja:id,codigo,nombre', 'abiertaPor:id,name', 'cerradaPor:id,name'])->toArray(),
            'saldos'      => $this->cajas->resumen($sesion),
            'movimientos' => $sesion->movimientos()
                ->with(['concepto:id,codigo,nombre,tipo,origen', 'banco:id,nombre', 'registradoPor:id,name', 'anuladoPor:id,name'])
                ->orderByDesc('id')
                ->get(),
        ]]);
    }
}
