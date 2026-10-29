<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\PublicarReglasPesoRequest;
use App\Modules\Cargas\Models\ReglaPeso;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Reglas del peso que vale (tramos de diferencia con fórmula) y su cálculo. */
class ReglaPesoController extends Controller
{
    public function index(): JsonResponse
    {
        $hoy = now()->toDateString();
        $juegos = ReglaPeso::query()->orderByDesc('vigente_desde')->orderBy('orden')->get()
            ->groupBy(fn ($r) => $r->vigente_desde->toDateString())
            ->map(fn ($g, $desde) => [
                'vigente_desde' => $desde,
                'vigente_hasta' => $g->first()->vigente_hasta?->toDateString(),
                'estado'        => $desde > $hoy ? 'PROXIMA'
                    : (($g->first()->vigente_hasta === null || $g->first()->vigente_hasta->toDateString() > $hoy) ? 'VIGENTE' : 'ANTERIOR'),
                'reglas'        => $g->values(),
            ])->values();

        return response()->json(['data' => $juegos]);
    }

    public function publicar(PublicarReglasPesoRequest $request): JsonResponse
    {
        $u = $request->user();
        $reglas = collect($request->input('reglas'))->map(fn ($r) => [
            'unidad' => $r['unidad'], 'desde' => $r['desde'] ?? null, 'hasta' => $r['hasta'] ?? null,
            'formula' => $r['formula'], 'descripcion' => $r['descripcion'] ?? null,
        ])->values();
        $n = Transaccion::como($u->id, fn () => (int) DB::selectOne(
            'select cargas.publicar_reglas_peso(?::date, ?::jsonb, ?) as n',
            [$request->input('vigente_desde'), $reglas->toJson(), $u->id]
        )->n);

        return response()->json(['mensaje' => "Reglas de peso publicadas ({$n}), rigen desde "
            . \Carbon\Carbon::parse($request->input('vigente_desde'))->format('d/m/Y') . '.'], 201);
    }

    /** Prueba una fórmula con un peso nuestro y uno del cliente, sin guardar. */
    public function probar(Request $request): JsonResponse
    {
        $d = $request->validate([
            'formula' => ['required', 'string', 'max:200'],
            'empresa' => ['required', 'numeric', 'gt:0'],
            'cliente' => ['required', 'numeric', 'gt:0'],
        ]);
        try {
            // En su propia transacción: si la fórmula falla, no arrastra la conexión.
            $kg = DB::transaction(fn () => DB::selectOne('select cargas.evaluar_formula_peso(?, ?, ?) as kg',
                [$d['formula'], $d['empresa'], $d['cliente']])->kg);
        } catch (QueryException $e) {
            return response()->json(['message' => self::mensaje($e), 'errors' => ['formula' => [self::mensaje($e)]]], 422);
        }

        return response()->json(['data' => ['kg' => (float) $kg]]);
    }

    /** Peso que vale para un neto nuestro y uno del cliente, con las reglas vigentes hoy. */
    public function calcular(Request $request): JsonResponse
    {
        $d = $request->validate([
            'empresa' => ['required', 'numeric', 'gt:0'],
            'cliente' => ['nullable', 'numeric', 'gt:0'],
        ]);
        $r = DB::selectOne('select * from cargas.peso_que_vale(?, ?, current_date)', [$d['empresa'], $d['cliente'] ?? null]);
        $regla = $r->regla_id ? ReglaPeso::find($r->regla_id) : null;

        return response()->json(['data' => [
            'kg'       => (float) $r->peso_kg,
            'criterio' => $r->criterio,
            'regla'    => $regla ? ['id' => $regla->id, 'orden' => $regla->orden, 'formula' => $regla->formula, 'descripcion' => $regla->descripcion] : null,
        ]]);
    }

    private static function mensaje(QueryException $e): string
    {
        $m = $e->getPrevious()?->getMessage() ?? $e->getMessage();
        if (preg_match('/ERROR:\s+(.+?)(\n|CONTEXT|$)/s', $m, $x)) {
            return trim($x[1]);
        }

        return 'La fórmula no se puede calcular.';
    }
}
