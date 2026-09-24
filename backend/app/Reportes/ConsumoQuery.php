<?php

namespace App\Reportes;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Consultas compartidas por los tres reportes de consumo.
 *
 * El costo SIEMPRE sale de `consumos_capa` — lo que el PEPS resolvió realmente
 * al confirmar cada salida. Nunca de cantidad x precio de lista: ese número no
 * cuadraría con ningún asiento contable.
 *
 * Las devoluciones se netean en el periodo en que se registraron, no en el de
 * la salida original. Así un reporte ya impreso y firmado no cambia de cifras
 * cuando alguien devuelve material tres meses después.
 */
class ConsumoQuery
{
    public function __construct(
        private Request $request,
        private ?int $almacenId = null,
    ) {
    }

    // --- Por unidad solicitante -------------------------------------------

    public function porArea(): Collection
    {
        $salidas = $this->baseSalidas()
            ->select([
                'u.id as unidad_id',
                'u.nombre as unidad',
                DB::raw('count(distinct s.id) as salidas'),
                DB::raw('count(distinct sol.id) as solicitantes'),
                DB::raw('sum(cc.cantidad) as cantidad'),
                DB::raw('sum(cc.cantidad * cc.costo_unitario) as costo'),
            ])
            ->groupBy('u.id', 'u.nombre')
            ->get()
            ->keyBy('unidad_id');

        $devoluciones = $this->baseDevoluciones()
            ->select([
                'u.id as unidad_id',
                DB::raw('sum(dc.cantidad) as cantidad'),
                DB::raw('sum(dc.costo_total) as costo'),
            ])
            ->groupBy('u.id')
            ->get()
            ->keyBy('unidad_id');

        $filas = $salidas->map(function ($fila) use ($devoluciones) {
            $dev = $devoluciones->get($fila->unidad_id);
            $costoDev = (float) ($dev->costo ?? 0);

            return [
                'unidad'       => $fila->unidad,
                'solicitantes' => (int) $fila->solicitantes,
                'salidas'      => (int) $fila->salidas,
                'cantidad'     => round((float) $fila->cantidad - (float) ($dev->cantidad ?? 0), 4),
                'salida'       => round((float) $fila->costo, 2),
                'devolucion'   => round($costoDev, 2),
                'neto'         => round((float) $fila->costo - $costoDev, 2),
                '_unidad_id'   => $fila->unidad_id,
            ];
        })->values();

        return $this->conParticipacion($filas)->sortByDesc('neto')->values();
    }

    /** Igual que porArea() pero con la comparación contra el periodo anterior. */
    public function porAreaConVariacion(): Collection
    {
        $actual = $this->porArea();
        $anterior = $this->delPeriodoAnterior()->porArea()->keyBy('_unidad_id');

        return $actual->map(function (array $fila) use ($anterior) {
            $previo = (float) ($anterior->get($fila['_unidad_id'])['neto'] ?? 0);
            $variacion = round($fila['neto'] - $previo, 2);

            return [
                ...$fila,
                'anterior'  => $previo,
                'variacion' => $previo > 0 ? round($variacion * 100 / $previo, 1) : null,
            ];
        });
    }

    // --- Por solicitante ---------------------------------------------------

    public function porSolicitante(): Collection
    {
        $salidas = $this->baseSalidas()
            ->select([
                'sol.id as solicitante_id',
                'sol.nombre as solicitante',
                'u.nombre as unidad',
                DB::raw('count(distinct s.id) as salidas'),
                DB::raw('sum(cc.cantidad * cc.costo_unitario) as costo'),
            ])
            ->groupBy('sol.id', 'sol.nombre', 'u.nombre')
            ->get()
            ->keyBy('solicitante_id');

        $devoluciones = $this->baseDevoluciones()
            ->select(['sol.id as solicitante_id', DB::raw('sum(dc.costo_total) as costo')])
            ->groupBy('sol.id')
            ->get()
            ->keyBy('solicitante_id');

        $filas = $salidas->map(function ($fila) use ($devoluciones) {
            $costoDev = (float) ($devoluciones->get($fila->solicitante_id)->costo ?? 0);

            return [
                'solicitante' => $fila->solicitante,
                'unidad'      => $fila->unidad,
                'salidas'     => (int) $fila->salidas,
                'salida'      => round((float) $fila->costo, 2),
                'devolucion'  => round($costoDev, 2),
                'neto'        => round((float) $fila->costo - $costoDev, 2),
            ];
        })->values();

        return $this->conParticipacion($filas)->sortByDesc('neto')->values();
    }

    // --- Por producto ------------------------------------------------------

    public function porProducto(): Collection
    {
        $salidas = $this->baseSalidas()
            ->join('productos as p', 'p.id', '=', 'sd.producto_id')
            ->leftJoin('categorias as cat', 'cat.id', '=', 'p.categoria_id')
            ->leftJoin('unidades_medida as um', 'um.id', '=', 'p.unidad_medida_id')
            ->select([
                'p.id as producto_id',
                'p.codigo',
                'p.nombre as producto',
                'cat.nombre as categoria',
                'um.codigo as unidad_medida',
                DB::raw('count(distinct u.id) as areas'),
                DB::raw('sum(cc.cantidad) as cantidad'),
                DB::raw('sum(cc.cantidad * cc.costo_unitario) as costo'),
            ])
            ->groupBy('p.id', 'p.codigo', 'p.nombre', 'cat.nombre', 'um.codigo')
            ->get()
            ->keyBy('producto_id');

        $devoluciones = $this->baseDevoluciones()
            ->select([
                'dd.producto_id',
                DB::raw('sum(dc.cantidad) as cantidad'),
                DB::raw('sum(dc.costo_total) as costo'),
            ])
            ->groupBy('dd.producto_id')
            ->get()
            ->keyBy('producto_id');

        $filas = $salidas->map(function ($fila) use ($devoluciones) {
            $dev = $devoluciones->get($fila->producto_id);
            $cantidad = round((float) $fila->cantidad - (float) ($dev->cantidad ?? 0), 4);
            $neto = round((float) $fila->costo - (float) ($dev->costo ?? 0), 2);

            return [
                'codigo'    => $fila->codigo,
                'producto'  => $fila->producto,
                'categoria' => $fila->categoria ?? '—',
                'unidad'    => $fila->unidad_medida,
                'areas'     => (int) $fila->areas,
                'cantidad'  => $cantidad,
                'costo'     => $cantidad > 0 ? round($neto / $cantidad, 4) : 0,
                'neto'      => $neto,
            ];
        })->values();

        return $this->conParticipacion($filas)->sortByDesc('neto')->values();
    }

    // --- Bases -------------------------------------------------------------

    private function baseSalidas()
    {
        $consulta = DB::table('consumos_capa as cc')
            ->join('salida_detalles as sd', 'sd.id', '=', 'cc.salida_detalle_id')
            ->join('salidas as s', 's.id', '=', 'sd.salida_id')
            ->join('solicitantes as sol', 'sol.id', '=', 's.solicitante_id')
            ->join('unidades_solicitantes as u', 'u.id', '=', 'sol.unidad_solicitante_id')
            ->where('s.estado', 'confirmada')
            ->whereBetween('s.fecha', [$this->desde(), $this->hasta()]);

        return $this->filtrar($consulta, 's');
    }

    private function baseDevoluciones()
    {
        // Filtra por la fecha de la DEVOLUCIÓN, no por la de la salida.
        // Esa decisión es la que mantiene inmutables los periodos ya cerrados.
        $consulta = DB::table('devoluciones_consumo as dc')
            ->join('devoluciones_detalle as dd', 'dd.id', '=', 'dc.devolucion_detalle_id')
            ->join('devoluciones as d', 'd.id', '=', 'dd.devolucion_id')
            ->join('solicitantes as sol', 'sol.id', '=', 'd.solicitante_id')
            ->join('unidades_solicitantes as u', 'u.id', '=', 'sol.unidad_solicitante_id')
            ->where('d.estado', 'registrada')
            ->whereBetween('d.fecha', [$this->desde(), $this->hasta()]);

        return $this->filtrar($consulta, 'd');
    }

    private function filtrar($consulta, string $alias)
    {
        if ($this->almacenId) {
            $consulta->where($alias.'.almacen_id', $this->almacenId);
        }

        if ($this->request->filled('unidad_id')) {
            $consulta->where('u.id', $this->request->integer('unidad_id'));
        }

        if ($this->request->filled('solicitante_id')) {
            $consulta->where('sol.id', $this->request->integer('solicitante_id'));
        }

        return $consulta;
    }

    // --- Utilidades --------------------------------------------------------

    private function conParticipacion(Collection $filas): Collection
    {
        $total = (float) $filas->sum('neto');

        return $filas->map(fn (array $fila) => [
            ...$fila,
            'participacion' => $total > 0 ? round($fila['neto'] * 100 / $total, 2) : 0,
        ]);
    }

    /** Mismo largo de periodo, inmediatamente anterior. */
    private function delPeriodoAnterior(): self
    {
        $desde = Carbon::parse($this->desde());
        $hasta = Carbon::parse($this->hasta());
        $dias = $desde->diffInDays($hasta) + 1;

        $anterior = clone $this->request;
        $anterior->merge([
            'desde' => $desde->copy()->subDays($dias)->toDateString(),
            'hasta' => $desde->copy()->subDay()->toDateString(),
        ]);

        return new self($anterior, $this->almacenId);
    }

    public function desde(): string
    {
        return $this->request->input('desde')
            ?? Carbon::now()->startOfMonth()->toDateString();
    }

    public function hasta(): string
    {
        return $this->request->input('hasta')
            ?? Carbon::now()->toDateString();
    }
}
