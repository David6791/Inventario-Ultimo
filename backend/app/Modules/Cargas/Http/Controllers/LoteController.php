<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\AnularLoteRequest;
use App\Modules\Cargas\Http\Requests\RecibirLoteRequest;
use App\Modules\Cargas\Models\Lote;
use App\Modules\Cargas\Services\RecepcionService;
use App\Modules\Comun\Support\CodigoBarras;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/** Lotes: recepción, listado con filtros, ficha, anulación y boleta. */
class LoteController extends Controller
{
    public function __construct(private readonly RecepcionService $recepcion)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $buscar = trim((string) $request->query('buscar'));

        $lotes = Lote::query()
            ->delAmbitoDe($request->user())
            ->when($request->filled('estado'), fn ($q) => $q->where('estado', $request->query('estado')))
            ->when($request->filled('serie_id'), fn ($q) => $q->where('serie_id', $request->integer('serie_id')))
            ->when($request->filled('desde'), fn ($q) => $q->whereDate('fecha_recepcion', '>=', $request->query('desde')))
            ->when($request->filled('hasta'), fn ($q) => $q->whereDate('fecha_recepcion', '<=', $request->query('hasta')))
            ->when($buscar !== '', fn ($q) => $q->where(fn ($w) => $w
                ->where('codigo', 'ilike', "%{$buscar}%")
                ->orWhereHas('productor', fn ($p) => $p->buscar($buscar))))
            ->with(['productor:id,nombre,ci,nit', 'cooperativa:id,nombre', 'linea:id,codigo,nombre',
                    'mina:id,nombre', 'bocamina:id,codigo,nombre', 'almacen:id,nombre'])
            ->orderByDesc('fecha_recepcion')->orderByDesc('id')
            ->paginate(min(100, $request->integer('por_pagina', 25)));

        $resumen = $this->resumen($lotes->getCollection()->pluck('id')->all());
        $lotes->getCollection()->transform(fn (Lote $l) => [...$l->toArray(), ...($resumen[$l->id] ?? [])]);

        return response()->json($lotes);
    }

    public function show(Request $request, Lote $lote): JsonResponse
    {
        abort_unless($lote->esDelAmbitoDe($request->user()), 403, 'El lote es de una sede a la que su usuario no tiene acceso.');

        return response()->json(['data' => $this->ficha($lote)]);
    }

    public function store(RecibirLoteRequest $request): JsonResponse
    {
        $r = $this->recepcion->recibir($request->datosLote(), $request->datosPesaje(), $request->user());

        return response()->json([
            'data'    => $this->ficha($r['lote']),
            'mensaje' => "Lote {$r['lote']->codigo} recibido."
                . ($r['bono'] ? " Bono de transporte: " . self::monto($r['bono']) . ", por pagar en caja." : ''),
        ], 201);
    }

    public function anular(AnularLoteRequest $request, Lote $lote): JsonResponse
    {
        abort_unless($lote->esDelAmbitoDe($request->user()), 403, 'El lote es de una sede a la que su usuario no tiene acceso.');
        $lote = $this->recepcion->anularLote($lote, $request->input('motivo'), $request->user());

        return response()->json(['data' => $this->ficha($lote), 'mensaje' => "Lote {$lote->codigo} anulado."]);
    }

    /** Boleta de recepción: original para la empresa y copia para el productor. */
    public function boleta(Request $request, Lote $lote): Response
    {
        abort_unless($lote->esDelAmbitoDe($request->user()), 403, 'El lote es de una sede a la que su usuario no tiene acceso.');

        return Pdf::loadView('pdf.cargas.boleta-recepcion', [
            'lote'        => $lote->load(['productor', 'cooperativa', 'linea', 'serie', 'mina', 'bocamina', 'municipio',
                                          'almacen', 'registradoPor:id,name', 'pesajes.bono']),
            'resumen'     => $this->resumen([$lote->id])[$lote->id] ?? [],
            'barras'      => CodigoBarras::dataUri($lote->codigo, 1.3, 46),
            'institucion' => config('app.empresa'),
        ])->setPaper([0, 0, 612, 396])->stream("boleta-{$lote->codigo}.pdf");   // media carta apaisada
    }

    private function ficha(Lote $lote): array
    {
        $lote->load([
            'productor:id,nombre,ci,nit,nim,tipo', 'cooperativa:id,nombre', 'linea:id,codigo,nombre,forma',
            'serie:id,prefijo,nombre', 'mina:id,nombre,propia', 'bocamina:id,codigo,nombre', 'municipio:id,nombre',
            'almacen:id,nombre', 'registradoPor:id,name', 'anuladoPor:id,name',
            'pesajes.registradoPor:id,name', 'pesajes.bono.movimiento:id,numero,caja_id,fecha',
            'eventos.usuario:id,name',
        ]);

        return [...$lote->toArray(), ...($this->resumen([$lote->id])[$lote->id] ?? [])];
    }

    /** Pesos y bonos por lote (de cargas.v_lote_resumen y los bonos). */
    private function resumen(array $ids): array
    {
        if (! $ids) {
            return [];
        }

        $pesos = collect(DB::table('cargas.v_lote_resumen')->whereIn('lote_id', $ids)
            ->get(['lote_id', 'num_pesajes', 'num_sacos', 'peso_neto_humedo_kg']))->keyBy('lote_id');

        $bonos = collect(DB::select(
            "select p.lote_id,
                    count(*) filter (where b.estado = 'PENDIENTE') as bonos_pendientes,
                    coalesce(sum(b.monto) filter (where b.estado = 'PENDIENTE'), 0) as bonos_por_pagar,
                    coalesce(sum(b.monto) filter (where b.estado = 'PAGADO'), 0) as bonos_pagados
               from cargas.bono_transporte b join cargas.pesaje p on p.id = b.pesaje_id
              where p.lote_id = any(?::bigint[])
              group by p.lote_id",
            ['{' . implode(',', $ids) . '}']
        ))->keyBy('lote_id');

        return collect($ids)->mapWithKeys(fn ($id) => [$id => [
            'num_pesajes'         => (int) ($pesos[$id]->num_pesajes ?? 0),
            'num_sacos'           => $pesos[$id]->num_sacos ?? null,
            'peso_neto_humedo_kg' => $pesos[$id]->peso_neto_humedo_kg ?? '0',
            'bonos_pendientes'    => (int) ($bonos[$id]->bonos_pendientes ?? 0),
            'bonos_por_pagar'     => $bonos[$id]->bonos_por_pagar ?? '0',
            'bonos_pagados'       => $bonos[$id]->bonos_pagados ?? '0',
        ]])->all();
    }

    private static function monto(\App\Modules\Cargas\Models\BonoTransporte $bono): string
    {
        return ($bono->moneda === 'USD' ? '$us ' : 'Bs ') . number_format((float) $bono->monto, 2, ',', '.');
    }
}
