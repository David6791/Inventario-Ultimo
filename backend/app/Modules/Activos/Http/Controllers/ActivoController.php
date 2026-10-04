<?php

namespace App\Modules\Activos\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Activos\Http\Requests\ActivoRequest;
use App\Modules\Activos\Http\Resources\ActivoListaResource;
use App\Modules\Activos\Http\Resources\ActivoResource;
use App\Modules\Activos\Models\Activo;
use App\Modules\Activos\Services\AltaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ActivoController extends Controller
{
    public function __construct(private readonly AltaService $altas)
    {
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $activos = Activo::query()
            ->with(['clase:id,nombre', 'subclase:id,nombre', 'ubicacion:id,nombre'])
            ->delAmbitoDe($request->user())
            ->when(! $request->boolean('incluir_bajas'), fn ($q) => $q->vigentes())
            ->when($request->boolean('solo_capitalizables'), fn ($q) => $q->capitalizables())
            ->when($request->filled('clase_id'),     fn ($q) => $q->where('clase_id', $request->integer('clase_id')))
            ->when($request->filled('subclase_id'),  fn ($q) => $q->where('subclase_id', $request->integer('subclase_id')))
            ->when($request->filled('ubicacion_id'), fn ($q) => $q->where('ubicacion_id', $request->integer('ubicacion_id')))
            ->when($request->filled('custodio_id'),  fn ($q) => $q->where('custodio_id', $request->integer('custodio_id')))
            ->when($request->filled('estado'),       fn ($q) => $q->where('estado', $request->string('estado')))
            ->when($request->filled('buscar'), function ($q) use ($request) {
                $texto = '%' . $request->string('buscar') . '%';
                $q->where(fn ($s) => $s
                    ->where('codigo', 'ilike', $texto)
                    ->orWhere('denominacion', 'ilike', $texto)
                    ->orWhere('serie', 'ilike', $texto)
                    ->orWhere('marca', 'ilike', $texto)
                    ->orWhere('modelo', 'ilike', $texto));
            })
            ->orderByDesc('fecha_incorporacion')
            ->orderByDesc('id')
            ->paginate($request->integer('por_pagina', 20))
            ->withQueryString();

        return ActivoListaResource::collection($activos);
    }

    public function show(Activo $activo): ActivoResource
    {
        return new ActivoResource(
            $activo->load(['clase', 'subclase', 'ubicacion', 'costos', 'movimientos', 'componentes'])
        );
    }

    /** Búsqueda por código exacto. La usa el escáner QR. */
    public function porCodigo(string $codigo): JsonResponse
    {
        $activo = Activo::where('codigo', $codigo)
            ->with(['clase', 'subclase', 'ubicacion'])
            ->first();

        if (! $activo) {
            return response()->json(['mensaje' => "No existe un activo con el código {$codigo}."], 404);
        }

        return response()->json(['data' => new ActivoResource($activo)]);
    }

    public function store(ActivoRequest $request): JsonResponse
    {
        $datos  = $request->safe()->except('costos');
        $costos = $request->safe()->only('costos')['costos'];

        try {
            $activo = $this->altas->registrar($datos, $costos, $request->user()->id);
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }

        return response()->json(['data' => new ActivoResource($activo)], 201);
    }

    /**
     * Edición de datos descriptivos. No toca código, valor de origen ni
     * estado: el código es inmutable, el valor cambia solo por mejoras o
     * revalúos, y el estado por documentos de custodia o baja.
     */
    public function update(ActivoRequest $request, Activo $activo): ActivoResource
    {
        $editables = $request->safe()->only([
            'denominacion', 'descripcion', 'marca', 'modelo', 'serie',
            'chasis', 'motor', 'placa', 'anio_fabricacion',
            'condicion', 'ubicacion_id', 'centro_costo_id',
            'latitud', 'longitud', 'matricula_ddrr', 'observaciones',
            'fecha_inicio_uso', 'vida_util_economica_meses',
        ]);

        DB::transaction(function () use ($activo, $editables, $request) {
            $ubicacionAnterior = $activo->ubicacion_id;

            $activo->update($editables);

            // Un cambio de ubicación desde la ficha se registra igual: la
            // bitácora tiene que explicar por qué el bien está donde está.
            if (isset($editables['ubicacion_id']) && $editables['ubicacion_id'] != $ubicacionAnterior) {
                $activo->movimientos()->create([
                    'tipo'                  => 'CAMBIO_ESTADO',
                    'fecha'                 => now(),
                    'ubicacion_anterior_id' => $ubicacionAnterior,
                    'ubicacion_nueva_id'    => $editables['ubicacion_id'],
                    'usuario_id'            => $request->user()->id,
                    'detalle'               => ['motivo' => 'Corrección desde la ficha'],
                ]);
            }
        });

        return new ActivoResource($activo->fresh()->load(['clase', 'subclase', 'ubicacion', 'costos']));
    }

    /** Los activos no se eliminan: se dan de baja con causal (sprint 9). */
    public function destroy(Activo $activo): JsonResponse
    {
        abort(405, 'Los activos no se eliminan. Use el procedimiento de baja, que exige causal y autorización.');
    }

    /** Datos para imprimir etiquetas. El QR se arma en el navegador. */
    public function etiquetas(Request $request): JsonResponse
    {
        $ids = $request->input('ids', []);

        abort_if(empty($ids), 422, 'Seleccione al menos un activo.');

        $activos = Activo::whereIn('id', $ids)
            ->with(['clase:id,nombre'])
            ->orderBy('codigo')
            ->get()
            ->map(fn ($a) => [
                'codigo'       => $a->codigo,
                'denominacion' => $a->denominacion,
                'clase'        => $a->clase?->nombre,
                'serie'        => $a->serie,
            ]);

        return response()->json(['data' => $activos]);
    }
}
