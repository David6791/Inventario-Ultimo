<?php

namespace App\Modules\Caja\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Caja\Http\Requests\AbrirSesionRequest;
use App\Modules\Caja\Http\Requests\CerrarSesionRequest;
use App\Modules\Caja\Http\Requests\ValidarSesionRequest;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Sesion;
use App\Modules\Caja\Services\CajaService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sesiones de caja: apertura, cierre con arqueo, validación por un
 * supervisor, historial y reporte diario.
 */
class SesionController extends Controller
{
    use AmbitoDeCaja;

    public function __construct(private readonly CajaService $cajas)
    {
    }

    /** Historial de cierres de las cajas que el usuario puede ver. */
    public function lista(Request $request): JsonResponse
    {
        $cajas = Caja::query()->delAmbitoDe($request->user())->pluck('id');

        $sesiones = Sesion::query()
            ->whereIn('caja_id', $cajas)
            ->when($request->filled('caja_id'), fn ($q) => $q->where('caja_id', $request->integer('caja_id')))
            ->when($request->filled('estado'), fn ($q) => $q->where('estado', $request->query('estado')))
            ->when($request->filled('desde'), fn ($q) => $q->whereDate('abierta_en', '>=', $request->query('desde')))
            ->when($request->filled('hasta'), fn ($q) => $q->whereDate('abierta_en', '<=', $request->query('hasta')))
            ->with(['caja:id,codigo,nombre', 'abiertaPor:id,name', 'cerradaPor:id,name', 'validadaPor:id,name', 'saldos'])
            ->orderByDesc('abierta_en')
            ->paginate(min(100, $request->integer('por_pagina', 25)));

        return response()->json($sesiones);
    }

    public function index(Caja $caja): JsonResponse
    {
        $this->asegurarAmbito($caja);

        $sesiones = $caja->sesiones()
            ->with(['abiertaPor:id,name', 'cerradaPor:id,name', 'validadaPor:id,name', 'saldos'])
            ->orderByDesc('numero')
            ->paginate(20);

        return response()->json($sesiones);
    }

    public function store(AbrirSesionRequest $request, Caja $caja): JsonResponse
    {
        $this->asegurarCajero($caja);

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
            ...$sesion->load(['caja:id,codigo,nombre', 'abiertaPor:id,name', 'cerradaPor:id,name', 'validadaPor:id,name', 'arqueo'])->toArray(),
            'saldos'          => $this->cajas->resumen($sesion),
            'por_concepto'    => $this->cajas->porConcepto($sesion),
            'denominaciones'  => Sesion::DENOMINACIONES,
            'movimientos'     => $sesion->movimientos()
                ->with(['concepto:id,codigo,nombre,tipo,origen', 'banco:id,nombre', 'registradoPor:id,name', 'anuladoPor:id,name'])
                ->orderByDesc('id')
                ->get(),
        ]]);
    }

    public function cerrar(CerrarSesionRequest $request, Sesion $sesion): JsonResponse
    {
        $this->asegurarCajero($sesion->caja);

        $sesion = $this->cajas->cerrar($sesion->load('saldos'), $request->user(),
            $request->input('monedas', []), $request->input('observaciones'));

        return response()->json([
            'data'    => [...$sesion->toArray(), 'saldos' => $this->cajas->resumen($sesion)],
            'mensaje' => "Sesión {$sesion->numero} cerrada. Imprima el reporte y entréguelo con el efectivo.",
        ]);
    }

    public function validar(ValidarSesionRequest $request, Sesion $sesion): JsonResponse
    {
        $this->asegurarAmbito($sesion->caja);

        $sesion = $this->cajas->validar($sesion, $request->user());

        return response()->json([
            'data'    => $sesion,
            'mensaje' => "Cierre de la sesión {$sesion->numero} validado.",
        ]);
    }

    /**
     * Reporte diario de la sesión. Con la sesión abierta sale marcado como
     * preliminar: el definitivo es el del cierre.
     */
    public function reporte(Sesion $sesion): Response
    {
        $this->asegurarAmbito($sesion->caja);

        $sesion->load(['caja.almacen:id,nombre', 'abiertaPor:id,name', 'cerradaPor:id,name', 'validadaPor:id,name', 'arqueo']);
        $movimientos = $sesion->movimientos()
            ->with(['concepto:id,nombre', 'banco:id,nombre', 'anuladoPor:id,name'])
            ->orderBy('fecha')->orderBy('id')
            ->get();

        return Pdf::loadView('pdf.caja.reporte-sesion', [
            'sesion'       => $sesion,
            'saldos'       => $this->cajas->resumen($sesion),
            'porConcepto'  => collect($this->cajas->porConcepto($sesion)),
            'movimientos'  => $movimientos,
            'institucion'  => config('app.name'),
        ])->setPaper('letter')->stream("caja-{$sesion->caja->codigo}-sesion-{$sesion->numero}.pdf");
    }
}
