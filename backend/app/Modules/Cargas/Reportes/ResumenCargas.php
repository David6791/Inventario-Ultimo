<?php

namespace App\Modules\Cargas\Reportes;

use App\Models\User;
use App\Modules\Cargas\Models\Lote;
use Illuminate\Support\Facades\DB;

/**
 * Resumen de la carga recibida en un período: por acopio, por tipo (serie),
 * por material, compra o producción propia (por mina y bocamina) y por día.
 * El peso es el que vale (húmedo) de cada lote; los lotes anulados no cuentan.
 * Respeta el ámbito del usuario (sus acopios, o todos si los ve todos).
 */
class ResumenCargas
{
    public readonly array $datos;

    /** @param array{desde: string, hasta: string, almacen_id?: ?int, origen?: ?string, serie_id?: ?int, material?: ?string} $f */
    public function __construct(public readonly array $f, User $usuario)
    {
        $ids = Lote::query()->delAmbitoDe($usuario)
            ->where('estado', '<>', 'ANULADO')
            ->whereDate('fecha_recepcion', '>=', $f['desde'])
            ->whereDate('fecha_recepcion', '<=', $f['hasta'])
            ->when($f['almacen_id'] ?? null, fn ($q, $v) => $q->where('almacen_id', $v))
            ->when($f['origen'] ?? null, fn ($q, $v) => $q->where('origen', $v))
            ->when($f['serie_id'] ?? null, fn ($q, $v) => $q->where('serie_id', $v))
            ->when($f['material'] ?? null, fn ($q, $v) => $v === 'SIN' ? $q->whereNull('material') : $q->where('material', $v))
            ->pluck('id')->all();

        $base = DB::table('cargas.lote as l')
            ->join('cargas.v_lote_resumen as r', 'r.lote_id', '=', 'l.id')
            ->whereIn('l.id', $ids ?: [0]);
        $kg = 'coalesce(sum(r.peso_neto_humedo_kg), 0)';
        $agrupar = fn (string $clave, string $nombre, array $joins = [], ?string $orden = null) => (clone $base)
            ->tap(function ($q) use ($joins) { foreach ($joins as $j) { $q->leftJoin(...$j); } })
            ->selectRaw("{$clave} as clave, {$nombre} as nombre, count(*) as lotes, {$kg} as kg")
            ->groupByRaw("{$clave}, {$nombre}")
            ->orderByRaw($orden ?? "{$kg} desc")
            ->get()->map(fn ($x) => ['clave' => $x->clave, 'nombre' => $x->nombre, 'lotes' => (int) $x->lotes, 'kg' => (float) $x->kg])->all();

        $tot = (clone $base)->selectRaw("count(*) as lotes, {$kg} as kg, count(*) filter (where l.origen = 'PROPIA') as propios")->first();

        $this->datos = [
            'totales'    => ['lotes' => (int) $tot->lotes, 'kg' => (float) $tot->kg, 'lotes_propios' => (int) $tot->propios],
            'por_acopio' => $agrupar('l.almacen_id', "coalesce(cc.nombre, a.nombre)",
                [['almacenes as a', 'a.id', '=', 'l.almacen_id'], ['activos.centro_costo as cc', fn ($j) => $j->on('cc.almacen_id', '=', 'l.almacen_id')->where('cc.activo', true)]]),
            'por_tipo'   => $agrupar('s.prefijo', 's.nombre', [['cargas.serie_lote as s', 's.id', '=', 'l.serie_id']]),
            'por_material' => $agrupar("coalesce(l.material, 'SIN')", "coalesce(l.material, 'Sin material')"),
            'por_origen' => $agrupar('l.origen', "case l.origen when 'PROPIA' then 'Producción propia' else 'Compra' end"),
            'produccion_propia' => (clone $base)->where('l.origen', 'PROPIA')
                ->leftJoin('cargas.mina as m', 'm.id', '=', 'l.mina_id')
                ->leftJoin('cargas.bocamina as b', 'b.id', '=', 'l.bocamina_id')
                ->selectRaw("m.nombre as mina, b.codigo as bocamina, count(*) as lotes, {$kg} as kg")
                ->groupBy('m.nombre', 'b.codigo')->orderBy('m.nombre')->orderBy('b.codigo')->get()
                ->map(fn ($x) => ['mina' => $x->mina, 'bocamina' => $x->bocamina, 'lotes' => (int) $x->lotes, 'kg' => (float) $x->kg])->all(),
            'por_dia'    => (clone $base)->selectRaw("l.fecha_recepcion::date as fecha, count(*) as lotes, {$kg} as kg")
                ->groupByRaw('l.fecha_recepcion::date')->orderByRaw('l.fecha_recepcion::date')->get()
                ->map(fn ($x) => ['fecha' => $x->fecha, 'lotes' => (int) $x->lotes, 'kg' => (float) $x->kg])->all(),
        ];
    }

    public function titulo(): string
    {
        $d = fn ($x) => \Carbon\Carbon::parse($x)->format('d/m/Y');

        return "Del {$d($this->f['desde'])} al {$d($this->f['hasta'])}";
    }
}
