<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Devolucion;
use App\Models\Salida;
use App\Services\DevolucionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DevolucionController extends Controller
{
    public function __construct(private DevolucionService $servicio)
    {
    }

    public function index(Request $peticion): JsonResponse
    {
        abort_unless(auth()->user()->can('devoluciones.ver'), 403);

        $consulta = Devolucion::with(['solicitante:id,nombre', 'unidadSolicitante:id,nombre'])
            ->when($peticion->filled('desde'), fn ($q) => $q->whereDate('fecha', '>=', $peticion->desde))
            ->when($peticion->filled('hasta'), fn ($q) => $q->whereDate('fecha', '<=', $peticion->hasta))
            ->when($peticion->filled('estado'), fn ($q) => $q->where('estado', $peticion->estado))
            ->when($peticion->filled('unidad_id'), fn ($q) => $q->where('unidad_solicitante_id', $peticion->unidad_id))
            ->withCount('detalles')
            ->orderByDesc('fecha')
            ->orderByDesc('id');

        return response()->json($consulta->paginate($peticion->integer('por_pagina', 25)));
    }

    public function ver(Devolucion $devolucion): JsonResponse
    {
        return response()->json(
            $devolucion->load(['detalles.consumos', 'salida:id,numero,fecha', 'usuario:id,nombre_completo'])
        );
    }
   

    public function registrar(Request $peticion): JsonResponse
    {
        abort_unless($peticion->user()->can('devoluciones.anular'), 403);
        $datos = $peticion->validate([
            'salida_id'                  => ['required', 'exists:salidas,id'],
            'fecha'                      => ['required', 'date'],
            'motivo'                     => ['required', 'string'],
            'observaciones'              => ['nullable', 'string', 'max:1000'],
            'items'                      => ['required', 'array', 'min:1'],
            'items.*.salida_detalle_id'  => ['required', 'exists:salidas_detalle,id'],
            'items.*.cantidad'           => ['required', 'numeric', 'gt:0'],
            'items.*.estado_bien'        => ['nullable', 'in:bueno,danado'],
            'items.*.observaciones'      => ['nullable', 'string', 'max:500'],
        ], [
            'items.required'            => 'Indique al menos un item a devolver.',
            'items.*.cantidad.gt'       => 'La cantidad debe ser mayor a cero.',
        ]);

        $salida = Salida::findOrFail($datos['salida_id']);

        $devolucion = $this->servicio->registrar($salida, $datos['items'], $datos);

        return response()->json([
            'devolucion' => $devolucion,
            'mensaje'    => "Devolucion {$devolucion->numero} registrada por Bs {$devolucion->costo_total}.",
        ], 201);
    }

    public function anular(Request $peticion, Devolucion $devolucion): JsonResponse
    {
        abort_unless($peticion->user()->can('devoluciones.anular'), 403);
        $datos = $peticion->validate([
            'motivo' => ['required', 'string', 'min:10', 'max:255'],
        ], [
            'motivo.min' => 'Explique el motivo de la anulacion en al menos 10 caracteres.',
        ]);

        $this->servicio->anular($devolucion, $datos['motivo']);

        return response()->json(['mensaje' => "Devolucion {$devolucion->numero} anulada."]);
    }
    

    /**
     * Qué se puede devolver todavía de una salida.
     *
     * Alimenta el formulario de devolución, así que exige el permiso de
     * registrar: quien solo consulta no necesita este endpoint.
     */
    public function devolvible(Request $peticion, Salida $salida): JsonResponse
    {
        abort_unless($peticion->user()->can('devoluciones.registrar'), 403);

        return response()->json([
            'salida' => [
                'id'          => $salida->id,
                'numero'      => $salida->numero,
                'fecha'       => $salida->fecha,
                'solicitante' => $salida->solicitante,
            ],
            'items' => $this->servicio->devolvibleDe($salida),
        ]);
    }
}
