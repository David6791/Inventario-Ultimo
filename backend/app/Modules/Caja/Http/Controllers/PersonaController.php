<?php

namespace App\Modules\Caja\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Caja\Http\Requests\PersonaRequest;
use App\Modules\Caja\Http\Requests\UnificarPersonaRequest;
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
            ->addSelect(['homonimos' => DB::table('caja.v_persona_homonimos as h')
                ->whereColumn('h.id', 'caja.persona.id')->select('h.homonimos')])
            ->orderBy('nombre')
            ->orderBy('id');

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

    /**
     * Antes de registrar: ¿ese nombre ya existe con otro CI, o ese CI ya es de
     * otra persona? Así se evita duplicar a alguien por un CI mal digitado.
     */
    public function coincidencias(Request $request): JsonResponse
    {
        $nombre = mb_strtoupper(preg_replace('/\s+/u', ' ', trim((string) $request->query('nombre'))));
        $ci = mb_strtoupper(trim((string) $request->query('ci')));

        $mismoNombre = $nombre === '' ? collect() : Persona::query()
            ->whereRaw('caja.normalizar_nombre(nombre) = ?', [$nombre])
            ->when($ci !== '', fn ($q) => $q->where(fn ($w) => $w->whereNull('ci')->orWhere('ci', '<>', $ci)))
            ->where('activo', true)
            ->orderBy('id')
            ->get(['id', 'nombre', 'ci']);

        $mismoCi = $ci === '' ? null : Persona::where('ci', $ci)->first(['id', 'nombre', 'ci']);

        return response()->json(['data' => [
            'mismo_nombre' => $mismoNombre,
            'mismo_ci'     => $mismoCi && $mismoCi->nombre !== $nombre ? $mismoCi : null,
        ]]);
    }

    /** Pasa los movimientos de esta persona a otra y la elimina del registro. */
    public function unificar(UnificarPersonaRequest $request, Persona $persona): JsonResponse
    {
        $destino = Persona::findOrFail($request->integer('destino_id'));

        $movidos = Transaccion::delUsuarioActual(fn () => DB::selectOne(
            'select caja.unificar_personas(?, ?, ?, ?) as n',
            [$persona->id, $destino->id, $request->user()->id, $request->input('motivo')]
        )->n);

        return response()->json([
            'data'    => $destino->refresh(),
            'mensaje' => "Unificado: {$movidos} movimiento(s) de {$persona->nombre}"
                . ($persona->ci ? " (CI {$persona->ci})" : '') . " pasaron a {$destino->nombre}.",
        ]);
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
