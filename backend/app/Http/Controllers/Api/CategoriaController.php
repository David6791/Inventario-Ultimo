<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CategoriaRequest;
use App\Http\Resources\CategoriaResource;
use App\Models\Categoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CategoriaController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('categorias.ver'), 403);

        $categorias = Categoria::query()
            ->withCount('productos')
            ->when($request->filled('buscar'), function ($q) use ($request) {
                $texto = '%'.$request->string('buscar').'%';
                $q->where(fn ($s) => $s->where('nombre', 'ilike', $texto)
                    ->orWhere('codigo', 'ilike', $texto));
            })
            ->when($request->boolean('solo_activas'), fn ($q) => $q->activos())
            ->orderBy('nombre')
            ->get();

        return CategoriaResource::collection($categorias);
    }

    public function store(CategoriaRequest $request): JsonResponse
    {
        abort_unless($request->user()->can('categorias.gestionar'), 403);

        $categoria = Categoria::create($request->validated());

        return response()->json(new CategoriaResource($categoria), 201);
    }

    public function update(CategoriaRequest $request, Categoria $categoria): CategoriaResource
    {
        abort_unless($request->user()->can('categorias.gestionar'), 403);

        $categoria->update($request->validated());

        return new CategoriaResource($this->conConteo($categoria->fresh()));
    }

    public function destroy(Request $request, Categoria $categoria): JsonResponse
    {
        abort_unless($request->user()->can('categorias.gestionar'), 403);

        abort_if(
            ! $categoria->puedeEliminarse(),
            409,
            'No se puede eliminar: hay productos en esta categoría. Desactívela en su lugar.'
        );

        $categoria->delete();

        return response()->json(['mensaje' => 'Categoría eliminada.']);
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
