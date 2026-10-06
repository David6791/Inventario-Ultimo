<?php

namespace App\Modules\Activos\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Activos\Models\Area;
use App\Modules\Activos\Models\CentroCosto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Centros de costo y áreas.
 *
 * El centro de costo es la unidad organizativa real: tiene su almacén, su
 * personal y sus ubicaciones. Asignarle el almacén es lo que habilita la
 * visibilidad: sin eso, nadie ve los activos de ese centro.
 */
class CentroCostoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $centros = CentroCosto::query()
            ->with('area:id,codigo,nombre')
            ->when(! $request->boolean('incluir_inactivos'), fn ($q) => $q->activos())
            ->when($request->filled('area_id'), fn ($q) => $q->where('area_id', $request->integer('area_id')))
            ->withCount(['empleados', 'activos'])
            ->orderBy('codigo')
            ->get()
            ->map(fn ($c) => [
                'id'              => $c->id,
                'codigo'          => $c->codigo,
                'nombre'          => $c->nombre,
                'etiqueta'        => $c->etiqueta,
                'area_id'         => $c->area_id,
                'area'            => $c->area?->codigo,
                'almacen_id'      => $c->almacen_id,
                'almacen'         => $this->nombreAlmacen($c->almacen_id),
                'responsable_id'  => $c->responsable_id,
                'empleados_count' => $c->empleados_count,
                'activos_count'   => $c->activos_count,
                // Sin almacén el centro es invisible: nadie ve sus bienes.
                'sin_ambito'      => $c->almacen_id === null,
                'activo'          => $c->activo,
            ]);

        return response()->json(['data' => $centros]);
    }

    public function areas(): JsonResponse
    {
        $areas = Area::activas()
            ->withCount('centros')
            ->orderBy('codigo')
            ->get(['id', 'codigo', 'nombre', 'activo']);

        return response()->json(['data' => $areas]);
    }

    public function store(Request $request): JsonResponse
    {
        $datos = $this->validarDatos($request);

        $centro = CentroCosto::create($datos);

        return response()->json(['data' => $centro->load('area')], 201);
    }

    public function update(Request $request, CentroCosto $centro): JsonResponse
    {
        $datos = $this->validarDatos($request, $centro->id);

        $centro->update($datos);

        return response()->json([
            'data'    => $centro->fresh()->load('area'),
            'mensaje' => $centro->almacen_id
                ? 'Centro actualizado.'
                : 'Centro actualizado, pero sigue sin almacén: nadie verá sus activos.',
        ]);
    }

    public function storeArea(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'codigo' => ['required', 'string', 'max:30', Rule::unique(Area::class, 'codigo')],
            'nombre' => ['required', 'string', 'max:120'],
        ]);

        return response()->json(['data' => Area::create($datos)], 201);
    }

    private function validarDatos(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'area_id' => ['required', 'integer', Rule::exists(Area::class, 'id')],
            'codigo'  => ['required', 'string', 'max:40',
                          Rule::unique(CentroCosto::class, 'codigo')->ignore($id)],
            'nombre'  => ['required', 'string', 'max:150'],
            // Opcional en la carga inicial, pero sin él el centro es invisible.
            'almacen_id'     => ['nullable', 'integer'],
            'responsable_id' => ['nullable', 'integer',
                                 Rule::exists(\App\Modules\Activos\Models\Empleado::class, 'id')],
            'activo'         => ['boolean'],
        ], [
            'almacen_id.required' =>
                'El almacén define quién puede ver los activos de este centro.',
        ]);
    }

    private function nombreAlmacen(?int $id): ?string
    {
        if (! $id) {
            return null;
        }

        return DB::table('almacenes')->where('id', $id)->value('nombre');
    }
}
