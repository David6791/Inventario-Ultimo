<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SolicitanteRequest;
use App\Http\Requests\UnidadSolicitanteRequest;
use App\Http\Resources\SolicitanteResource;
use App\Http\Resources\UnidadSolicitanteResource;
use App\Models\Solicitante;
use App\Models\UnidadSolicitante;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Catálogo de unidades y personas que solicitan material.
 *
 * No son usuarios del sistema: la mayoría nunca entra a la aplicación. Por eso
 * viven en su propia tabla y no en `users`.
 */
class SolicitanteController extends Controller
{
    // --- Unidades ----------------------------------------------------------

    public function unidades(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->canAny(['solicitantes.ver', 'salidas.registrar']), 403);

        $unidades = UnidadSolicitante::query()
            ->withCount('solicitantes')
            ->when($request->boolean('solo_activas'), fn ($q) => $q->activas())
            ->when($request->filled('buscar'), function ($q) use ($request) {
                $texto = '%'.$request->string('buscar').'%';
                $q->where(fn ($s) => $s->where('nombre', 'ilike', $texto)
                    ->orWhere('codigo', 'ilike', $texto));
            })
            ->orderBy('nombre')
            ->get();

        return UnidadSolicitanteResource::collection($unidades);
    }

    public function guardarUnidad(UnidadSolicitanteRequest $request): JsonResponse
    {
        abort_unless($request->user()->can('solicitantes.gestionar'), 403);

        $unidad = UnidadSolicitante::create($request->validated());

        return response()->json(new UnidadSolicitanteResource($unidad), 201);
    }

    public function actualizarUnidad(
        UnidadSolicitanteRequest $request,
        UnidadSolicitante $unidad,
    ): UnidadSolicitanteResource {
        abort_unless($request->user()->can('solicitantes.gestionar'), 403);

        $unidad->update($request->validated());

        return new UnidadSolicitanteResource($this->conConteo($unidad->fresh()));
    }

    public function eliminarUnidad(Request $request, UnidadSolicitante $unidad): JsonResponse
    {
        abort_unless($request->user()->can('solicitantes.gestionar'), 403);

        abort_if(
            ! $unidad->puedeEliminarse(),
            409,
            'No se puede eliminar: la unidad tiene solicitantes o movimientos registrados. Desactívela en su lugar.'
        );

        $unidad->delete();

        return response()->json(['mensaje' => 'Unidad eliminada.']);
    }

    // --- Solicitantes ------------------------------------------------------

    public function index(Request $request): AnonymousResourceCollection
    {
        // `salidas.registrar` alcanza para consultar: el formulario de salida
        // necesita la lista para su desplegable.
        abort_unless($request->user()->canAny(['solicitantes.ver', 'salidas.registrar']), 403);

        $solicitantes = Solicitante::query()
            ->with('unidad:id,nombre,centro_costo')
            ->when($request->boolean('solo_activos'), fn ($q) => $q->activos())
            ->when($request->boolean('solo_retiran'), fn ($q) => $q->quePuedenRetirar())
            ->when($request->filled('unidad_id'),
                fn ($q) => $q->where('unidad_solicitante_id', $request->integer('unidad_id')))
            ->when($request->filled('buscar'), function ($q) use ($request) {
                $texto = '%'.$request->string('buscar').'%';
                $q->where(fn ($s) => $s->where('nombre', 'ilike', $texto)
                    ->orWhere('ci', 'ilike', $texto));
            })
            ->orderBy('nombre')
            ->get();

        return SolicitanteResource::collection($solicitantes);
    }

    public function store(SolicitanteRequest $request): JsonResponse
    {
        abort_unless($request->user()->can('solicitantes.gestionar'), 403);

        $solicitante = Solicitante::create($request->validated());

        return response()->json(
            new SolicitanteResource($solicitante->load('unidad:id,nombre,centro_costo')),
            201
        );
    }

    public function update(SolicitanteRequest $request, Solicitante $solicitante): SolicitanteResource
    {
        abort_unless($request->user()->can('solicitantes.gestionar'), 403);

        $solicitante->update($request->validated());

        return new SolicitanteResource(
            $solicitante->fresh()->load('unidad:id,nombre,centro_costo')
        );
    }

    /**
     * Solo se elimina si nunca movió material. Con movimientos se desactiva:
     * los documentos lo referencian.
     */
    public function destroy(Request $request, Solicitante $solicitante): JsonResponse
    {
        abort_unless($request->user()->can('solicitantes.gestionar'), 403);

        abort_if(
            $solicitante->tieneMovimientos(),
            409,
            'No se puede eliminar: esta persona tiene salidas registradas. Desactívela en su lugar.'
        );

        $solicitante->delete();

        return response()->json(['mensaje' => 'Solicitante eliminado.']);
    }
    /**
     * Recarga el modelo con el número de solicitantes.
     *
     * Se cuenta con una consulta propia en vez de `loadCount()`: esa función,
     * aplicada a un modelo suelto, reconsulta la tabla por clave y si la
     * reconsulta no devuelve filas falla adentro de Laravel con un error sobre
     * `getAttributes()` en nulo, que no dice nada de la causa.
     */
    private function conConteo($modelo)
    {
        $modelo->setAttribute('solicitantes_count', $modelo->solicitantes()->count());

        return $modelo;
    }
}
