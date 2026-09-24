<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UnidadMedidaRequest;
use App\Http\Resources\UnidadMedidaResource;
use App\Models\UnidadMedida;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class UnidadMedidaController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('categorias.ver'), 403);

        $unidades = UnidadMedida::query()
            ->withCount('productos')
            ->when($request->boolean('solo_activas'), fn ($q) => $q->activos())
            ->orderBy('nombre')
            ->get();

        return UnidadMedidaResource::collection($unidades);
    }

    public function store(UnidadMedidaRequest $request): JsonResponse
    {
        abort_unless($request->user()->can('categorias.gestionar'), 403);

        $unidad = UnidadMedida::create($request->validated());

        return response()->json(new UnidadMedidaResource($unidad), 201);
    }

    public function update(UnidadMedidaRequest $request, UnidadMedida $unidad): UnidadMedidaResource
    {
        abort_unless($request->user()->can('categorias.gestionar'), 403);

        // Cambiar permite_decimales con productos ya cargados dejaría cantidades
        // fraccionarias en una unidad que pasó a ser entera.
        if ($unidad->permite_decimales
            && ! $request->boolean('permite_decimales')
            && $unidad->productos()->exists()) {
            abort(409, 'No se puede quitar el uso de decimales: ya hay productos con esta unidad.');
        }

        $unidad->update($request->validated());

        return new UnidadMedidaResource($this->conConteo($unidad->fresh()));
    }

    public function destroy(Request $request, UnidadMedida $unidad): JsonResponse
    {
        abort_unless($request->user()->can('categorias.gestionar'), 403);

        abort_if(
            ! $unidad->puedeEliminarse(),
            409,
            'No se puede eliminar: hay productos que usan esta unidad. Desactívela en su lugar.'
        );

        $unidad->delete();

        return response()->json(['mensaje' => 'Unidad eliminada.']);
    }
    /**
     * Recarga el modelo con el número de productos.
     *
     * Se cuenta con una consulta propia en vez de `loadCount()`: esa función,
     * aplicada a un modelo suelto, reconsulta la tabla por clave y si la
     * reconsulta no devuelve filas falla adentro de Laravel con un error sobre
     * `getAttributes()` en nulo, que no dice nada de la causa.
     */
    private function conConteo($modelo)
    {
        $modelo->setAttribute('productos_count', $modelo->productos()->count());

        return $modelo;
    }
}
