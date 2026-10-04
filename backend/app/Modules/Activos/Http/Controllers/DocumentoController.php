<?php

namespace App\Modules\Activos\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Activos\Http\Requests\DocumentoRequest;
use App\Modules\Activos\Http\Resources\DocumentoResource;
use App\Modules\Activos\Models\Documento;
use App\Modules\Activos\Services\DocumentoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use RuntimeException;

class DocumentoController extends Controller
{
    public function __construct(private readonly DocumentoService $documentos)
    {
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $documentos = Documento::query()
            ->with(['detalles.activo:id,codigo,denominacion'])
            ->when($request->filled('tipo'),   fn ($q) => $q->delTipo($request->string('tipo')))
            ->when($request->filled('estado'), fn ($q) => $q->where('estado', $request->string('estado')))
            ->when($request->filled('custodio_id'), fn ($q) => $q->where(
                fn ($s) => $s->where('custodio_destino_id', $request->integer('custodio_id'))
                             ->orWhere('custodio_origen_id', $request->integer('custodio_id'))
            ))
            ->when($request->boolean('solo_vencidos'), fn ($q) => $q->retornoVencido())
            ->when($request->filled('buscar'), fn ($q) => $q->where('numero', 'ilike', '%' . $request->string('buscar') . '%'))
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->paginate($request->integer('por_pagina', 20))
            ->withQueryString();

        return DocumentoResource::collection($documentos);
    }

    public function show(Documento $documento): DocumentoResource
    {
        return new DocumentoResource($documento->load('detalles.activo'));
    }

    public function store(DocumentoRequest $request): JsonResponse
    {
        $datos = $request->safe()->except(['tipo', 'activos']);

        try {
            $documento = $this->documentos->emitir(
                $request->string('tipo'),
                $datos,
                $request->input('activos'),
                $request->user()->id
            );
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }

        return response()->json(['data' => new DocumentoResource($documento)], 201);
    }

    /** Hasta acá el documento no tocó ningún activo. Esto lo aplica. */
    public function confirmar(Documento $documento, Request $request): JsonResponse
    {
        $this->autorizarAccion($documento->tipo, 'confirmar', $request);

        try {
            $documento = $this->documentos->confirmar($documento, $request->user()->id);
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }

        return response()->json([
            'data'    => new DocumentoResource($documento),
            'mensaje' => "Documento {$documento->numero} confirmado.",
        ]);
    }

    public function anular(Documento $documento, Request $request): JsonResponse
    {
        $request->validate(['motivo' => ['required', 'string', 'min:5', 'max:500']]);

        $this->autorizarAccion($documento->tipo, 'anular', $request);

        try {
            $documento = $this->documentos->anular(
                $documento, $request->string('motivo'), $request->user()->id
            );
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }

        return response()->json([
            'data'    => new DocumentoResource($documento),
            'mensaje' => "Documento {$documento->numero} anulado. El efecto fue revertido.",
        ]);
    }

    public function registrarRetorno(Documento $documento, Request $request): JsonResponse
    {
        $request->validate(['fecha' => ['nullable', 'date', 'before_or_equal:today']]);

        try {
            $documento = $this->documentos->registrarRetorno(
                $documento, $request->user()->id, $request->input('fecha')
            );
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }

        return response()->json([
            'data'    => new DocumentoResource($documento),
            'mensaje' => 'Retorno registrado.',
        ]);
    }

    /** Bienes a cargo de un custodio. Es la base del descargo laboral. */
    public function porCustodio(int $custodioId): JsonResponse
    {
        $activos = \App\Modules\Activos\Models\Activo::query()
            ->where('custodio_id', $custodioId)
            ->vigentes()
            ->with(['clase:id,nombre', 'ubicacion:id,nombre'])
            ->orderBy('codigo')
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id, 'codigo' => $a->codigo,
                'denominacion' => $a->denominacion, 'serie' => $a->serie,
                'clase' => $a->clase?->nombre, 'ubicacion' => $a->ubicacion?->nombre,
                'estado' => $a->estado, 'condicion' => $a->condicion,
                'valor_origen' => (float) $a->valor_origen,
            ]);

        return response()->json([
            'data' => $activos,
            'resumen' => [
                'cantidad' => $activos->count(),
                'valor'    => round($activos->sum('valor_origen'), 2),
            ],
        ]);
    }

    /**
     * Autorizar es un acto distinto de emitir, y a veces de otra persona.
     * Se exige el permiso de autorización donde la matriz de segregación
     * lo separa.
     */
    private function autorizarAccion(string $tipo, string $accion, Request $request): void
    {
        $permiso = match ($tipo) {
            'TRASPASO'        => 'activos-custodia.autorizar-traspaso',
            'SALIDA_TEMPORAL' => 'activos-custodia.autorizar-salida',
            default           => 'activos-custodia.asignar',
        };

        abort_unless($request->user()->can($permiso), 403,
            "Necesita el permiso «{$permiso}» para {$accion} este documento.");
    }
}
