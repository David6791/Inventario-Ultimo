<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\PublicarTramosBonoRequest;
use App\Modules\Cargas\Http\Requests\TipoBonoRequest;
use App\Modules\Cargas\Models\SerieLote;
use App\Modules\Cargas\Models\TipoBono;
use App\Modules\Cargas\Models\TipoBonoTramo;
use App\Modules\Comun\Support\Transaccion;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Catálogo de bonos: alta, cambios, tablas de montos con vigencia y el cálculo previo para la recepción. */
class TipoBonoController extends Controller
{
    public function index(): JsonResponse
    {
        $hoy = now()->toDateString();
        $tramos = TipoBonoTramo::query()->orderByDesc('vigente_desde')->orderBy('desde')->get()->groupBy('tipo_bono_id');
        $uso = DB::table('cargas.bono')->selectRaw("tipo_bono_id, count(*) filter (where estado = 'PENDIENTE') as pendientes, count(*) as total")
            ->groupBy('tipo_bono_id')->get()->keyBy('tipo_bono_id');

        $tipos = TipoBono::query()->with(['serie:id,prefijo,nombre', 'concepto:id,codigo,nombre'])
            ->orderByDesc('activo')->orderBy('orden')->orderBy('id')->get()
            ->map(fn (TipoBono $t) => [
                ...$t->toArray(),
                'bonos_pendientes' => (int) ($uso[$t->id]->pendientes ?? 0),
                'bonos_total'      => (int) ($uso[$t->id]->total ?? 0),
                'tablas'           => ($tramos[$t->id] ?? collect())
                    ->groupBy(fn ($r) => $r->vigente_desde->toDateString())
                    ->map(fn ($g, $desde) => [
                        'vigente_desde' => $desde,
                        'vigente_hasta' => $g->first()->vigente_hasta?->toDateString(),
                        'estado'        => $desde > $hoy ? 'PROXIMA'
                            : (($g->first()->vigente_hasta === null || $g->first()->vigente_hasta->toDateString() > $hoy) ? 'VIGENTE' : 'ANTERIOR'),
                        'tramos'        => $g->values(),
                    ])->values(),
            ]);

        return response()->json(['data' => $tipos]);
    }

    public function store(TipoBonoRequest $request): JsonResponse
    {
        $datos = $request->validated();
        $datos['orden'] ??= (int) TipoBono::max('orden') + 1;          // al final del catálogo
        $tipo = Transaccion::como($request->user()->id, fn () => TipoBono::create($datos)->refresh());

        return response()->json(['data' => $tipo, 'mensaje' => "Bono «{$tipo->nombre}» creado."
            . ($tipo->calculo === 'MANUAL' ? ' Se agrega en la ficha de cada lote con su monto.' : ' Publique su tabla de montos para que empiece a generarse.')], 201);
    }

    public function update(TipoBonoRequest $request, TipoBono $tipo): JsonResponse
    {
        Transaccion::como($request->user()->id, fn () => $tipo->update($request->validated()));

        return response()->json(['data' => $tipo->refresh(), 'mensaje' => "Bono «{$tipo->nombre}» guardado."]);
    }

    public function publicar(PublicarTramosBonoRequest $request, TipoBono $tipo): JsonResponse
    {
        $u = $request->user();
        $n = Transaccion::como($u->id, fn () => (int) DB::selectOne(
            'select cargas.publicar_tramos_tipo_bono(?, ?::date, ?::jsonb, ?) as n',
            [$tipo->id, $request->input('vigente_desde'), json_encode(array_values($request->input('tramos'))), $u->id]
        )->n);

        return response()->json(['mensaje' => "Tabla de «{$tipo->nombre}» publicada ({$n} fila" . ($n === 1 ? '' : 's') . '), rige desde '
            . Carbon::parse($request->input('vigente_desde'))->format('d/m/Y') . '.'], 201);
    }

    /**
     * Qué bonos generaría hoy una recepción, para mostrarlos antes de guardar.
     * Con peso_kg: los que van con el pesaje de báscula. Con material o
     * serie_id: los que van con el lote.
     */
    public function calcular(Request $request): JsonResponse
    {
        $peso = $request->filled('peso_kg') ? (float) $request->query('peso_kg') : null;
        $material = trim((string) $request->query('material')) ?: null;
        $serie = $request->filled('serie_id') ? SerieLote::find($request->integer('serie_id')) : null;
        $deLote = $request->boolean('lote') || $material !== null || $serie !== null;

        $resultado = [];
        foreach (TipoBono::activos()->orderBy('orden')->orderBy('id')->get() as $t) {
            if ($serie && (($t->aplica_a !== 'TODOS' && $t->aplica_a !== $serie->origen) || ($t->serie_id && $t->serie_id !== $serie->id))) {
                continue;
            }
            $porPesaje = in_array($t->calculo, TipoBono::POR_PESAJE, true);
            if ($t->calculo === 'MANUAL' || ($porPesaje && ($peso === null || $peso <= 0)) || (! $porPesaje && ! $deLote)) {
                continue;
            }
            $base = match ($t->calculo) {
                'TRAMOS_PESO'   => $peso,
                'POR_ELEMENTOS' => $material ? (int) DB::selectOne('select cargas.num_elementos(?) as n', [$material])->n : null,
                default         => 0,
            };
            if ($t->calculo === 'POR_ELEMENTOS' && ! $base) {
                continue;
            }
            $r = DB::selectOne('select r.* from cargas.tipo_bono_tramo r where r.id = cargas.tramo_tipo_bono(?, ?, current_date)', [$t->id, $base]);
            if (! $r) {
                continue;
            }
            $monto = $t->calculo === 'POR_TONELADA' ? round((float) $r->monto * $peso / 1000, 2) : (float) $r->monto;
            $resultado[] = [
                'tipo_bono_id' => $t->id, 'codigo' => $t->codigo, 'nombre' => $t->nombre, 'calculo' => $t->calculo,
                'naturaleza' => $t->naturaleza, 'cobra' => $t->cobra, 'monto' => number_format($monto, 2, '.', ''), 'moneda' => $r->moneda,
                'detalle' => match ($t->calculo) {
                    'TRAMOS_PESO'   => $r->etiqueta,
                    'POR_ELEMENTOS' => $base . ' elemento' . ($base === 1 ? '' : 's'),
                    'POR_TONELADA'  => number_format((float) $r->monto, 2, ',', '.') . ' por tonelada',
                    default         => null,
                },
            ];
        }

        return response()->json(['data' => $resultado]);
    }
}
