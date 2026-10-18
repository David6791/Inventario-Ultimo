<?php

namespace App\Modules\Caja\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Caja\Http\Requests\PersonaRequest;
use App\Modules\Caja\Models\Persona;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Registro de personas a quienes la caja paga o de quienes recibe. Se llena
 * solo al registrar movimientos; aquí se consulta y se corrigen los datos.
 */
class PersonaController extends Controller
{
    /** Lista con búsqueda. Con ?limite= sirve de autocompletado (sin paginar). */
    public function index(Request $request): JsonResponse
    {
        $consulta = Persona::query()
            ->buscar($request->query('buscar'))
            ->withCount(['movimientos as movimientos' => fn ($q) => $q->where('estado', 'VIGENTE')])
            ->orderBy('nombre');

        if ($request->filled('limite')) {
            return response()->json([
                'data' => $consulta->where('activo', true)
                    ->limit(min(30, $request->integer('limite')))
                    ->get(['id', 'nombre', 'ci']),
            ]);
        }

        $pagina = $consulta->paginate(min(100, $request->integer('por_pagina', 25)));
        $resumen = $this->resumen($pagina->getCollection()->pluck('id')->all());
        $pagina->getCollection()->transform(fn (Persona $p) => [...$p->toArray(), 'totales' => $resumen[$p->id] ?? []]);

        return response()->json($pagina);
    }

    public function show(Persona $persona): JsonResponse
    {
        $movimientos = $persona->movimientos()
            ->with(['concepto:id,nombre,tipo', 'caja:id,codigo,nombre', 'registradoPor:id,name'])
            ->orderByDesc('fecha')
            ->limit(200)
            ->get();

        return response()->json(['data' => [
            ...$persona->toArray(),
            'totales'     => $this->resumen([$persona->id])[$persona->id] ?? [],
            'movimientos' => $movimientos,
        ]]);
    }

    public function update(PersonaRequest $request, Persona $persona): JsonResponse
    {
        Transaccion::delUsuarioActual(fn () => $persona->update($request->validated()));

        return response()->json(['data' => $persona->refresh()]);
    }

    /** Totales vigentes por moneda (caja.v_persona_resumen). */
    private function resumen(array $ids): array
    {
        if (! $ids) {
            return [];
        }

        return collect(DB::table('caja.v_persona_resumen')->whereIn('persona_id', $ids)->get())
            ->groupBy('persona_id')
            ->map(fn ($filas) => $filas->map(fn ($f) => [
                'moneda'            => $f->moneda,
                'movimientos'       => (int) $f->movimientos,
                'total_ingresos'    => $f->total_ingresos,
                'total_egresos'     => $f->total_egresos,
                'ultimo_movimiento' => $f->ultimo_movimiento,
            ])->values()->all())
            ->all();
    }
}
