<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AlmacenRequest;
use App\Http\Resources\AlmacenResource;
use App\Models\Almacen;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class AlmacenController extends Controller
{
    /**
     * Sirve a dos consumidores: la pantalla del catálogo y los selectores del
     * módulo de usuarios. Por eso `almacenes.ver` alcanza para listar, aunque
     * modificar exija `almacenes.gestionar`.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless(
            $request->user()->canAny(['almacenes.ver', 'usuarios.ver']),
            403
        );

        $almacenes = Almacen::query()
            ->withCount('usuarios')
            ->when($request->boolean('solo_activos'), fn ($q) => $q->activos())
            ->orderBy('nombre')
            ->get();

        return AlmacenResource::collection($almacenes);
    }

    public function store(AlmacenRequest $request): JsonResponse
    {
        abort_unless($request->user()->can('almacenes.gestionar'), 403);

        $almacen = Almacen::create($request->validated());

        return response()->json(new AlmacenResource($almacen), 201);
    }

    public function update(AlmacenRequest $request, Almacen $almacen): AlmacenResource
    {
        abort_unless($request->user()->can('almacenes.gestionar'), 403);

        $almacen->update($request->validated());

        return new AlmacenResource($this->conConteo($almacen->fresh()));
    }

    /**
     * Los almacenes no se eliminan: el kardex y los documentos los referencian
     * para siempre. Se desactivan, y con eso dejan de aparecer en los
     * selectores de movimientos.
     */
    public function cambiarEstado(Request $request, Almacen $almacen): AlmacenResource
    {
        abort_unless($request->user()->can('almacenes.gestionar'), 403);

        $activo = $request->boolean('activo');

        abort_if(
            ! $activo && $almacen->usuarios()->exists(),
            409,
            'No se puede desactivar: hay usuarios asignados a este almacén. Reasígnelos primero.'
        );

        $almacen->update(['activo' => $activo]);

        return new AlmacenResource($this->conConteo($almacen->fresh()));
    }
    /**
     * Recarga el modelo con el número de usuarios.
     *
     * Se cuenta con una consulta propia en vez de `loadCount()`: esa función,
     * aplicada a un modelo suelto, reconsulta la tabla por clave y si la
     * reconsulta no devuelve filas falla adentro de Laravel con un error sobre
     * `getAttributes()` en nulo, que no dice nada de la causa.
     */
    private function conConteo($modelo)
    {
        $modelo->setAttribute('usuarios_count', $modelo->usuarios()->count());

        return $modelo;
    }
}
