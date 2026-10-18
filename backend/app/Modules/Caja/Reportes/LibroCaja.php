<?php

namespace App\Modules\Caja\Reportes;

use App\Models\User;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Movimiento;
use Illuminate\Support\Collection;

/**
 * Libro de caja: los movimientos de un rango de fechas, con ingresos y
 * egresos en efectivo y en otras formas de pago, totales y resumen por
 * concepto. Solo las cajas que el usuario puede ver.
 */
class LibroCaja
{
    /** @var Collection<int, Movimiento> */
    public Collection $movimientos;
    public array $totales;
    public Collection $porConcepto;
    public ?Caja $caja;
    public ?string $concepto;

    public function __construct(public readonly array $filtros, User $usuario)
    {
        $this->caja = isset($filtros['caja_id']) ? Caja::find($filtros['caja_id']) : null;
        $moneda = $filtros['moneda'] ?? 'BOB';
        $cajas = Caja::query()->delAmbitoDe($usuario)->pluck('id');

        $this->movimientos = Movimiento::query()
            ->whereIn('caja_id', $cajas)
            ->when($this->caja, fn ($q) => $q->where('caja_id', $this->caja->id))
            ->when($filtros['concepto_id'] ?? null, fn ($q, $id) => $q->where('concepto_id', $id))
            ->where('moneda', $moneda)
            ->when(! ($filtros['incluir_anulados'] ?? false), fn ($q) => $q->where('estado', Movimiento::VIGENTE))
            ->whereDate('fecha', '>=', $filtros['desde'])
            ->whereDate('fecha', '<=', $filtros['hasta'])
            ->with(['concepto:id,nombre,codigo', 'caja:id,codigo', 'banco:id,nombre', 'sesion:id,numero'])
            ->orderBy('fecha')->orderBy('id')
            ->get();

        $vigentes = $this->movimientos->where('estado', Movimiento::VIGENTE);
        $suma = fn (string $tipo, bool $efectivo) => round((float) $vigentes
            ->where('tipo', $tipo)
            ->filter(fn ($m) => ($m->forma_pago === 'EFECTIVO') === $efectivo)
            ->sum('monto'), 2);

        $this->totales = [
            'moneda'               => $moneda,
            'movimientos'          => $vigentes->count(),
            'ingresos_efectivo'    => $suma('INGRESO', true),
            'egresos_efectivo'     => $suma('EGRESO', true),
            'ingresos_otras'       => $suma('INGRESO', false),
            'egresos_otras'        => $suma('EGRESO', false),
        ];
        $this->totales['neto_efectivo'] = round($this->totales['ingresos_efectivo'] - $this->totales['egresos_efectivo'], 2);

        $this->porConcepto = $vigentes
            ->groupBy(fn ($m) => $m->tipo . '|' . $m->concepto?->nombre)
            ->map(fn ($grupo, $clave) => [
                'tipo'        => explode('|', $clave, 2)[0],
                'concepto'    => explode('|', $clave, 2)[1],
                'movimientos' => $grupo->count(),
                'efectivo'    => round((float) $grupo->where('forma_pago', 'EFECTIVO')->sum('monto'), 2),
                'otras'       => round((float) $grupo->where('forma_pago', '<>', 'EFECTIVO')->sum('monto'), 2),
                'total'       => round((float) $grupo->sum('monto'), 2),
            ])
            ->sortBy([['tipo', 'desc'], ['total', 'desc']])
            ->values();

        $this->concepto = $this->movimientos->first(fn ($m) => $m->concepto_id == ($filtros['concepto_id'] ?? null))?->concepto?->nombre;
    }

    public function titulo(): string
    {
        $desde = \Carbon\Carbon::parse($this->filtros['desde'])->format('d/m/Y');
        $hasta = \Carbon\Carbon::parse($this->filtros['hasta'])->format('d/m/Y');

        return ($desde === $hasta ? "del {$desde}" : "del {$desde} al {$hasta}")
            . ($this->caja ? " · Caja {$this->caja->codigo}" : ' · Todas las cajas')
            . ($this->concepto ? " · {$this->concepto}" : '');
    }

    public function filas(): array
    {
        return $this->movimientos->map(fn (Movimiento $m) => [
            'id'          => $m->id,
            'fecha'       => $m->fecha?->toIso8601String(),
            'numero'      => $m->numero,
            'caja'        => $m->caja?->codigo,
            'sesion'      => $m->sesion?->numero,
            'tipo'        => $m->tipo,
            'concepto'    => $m->concepto?->nombre,
            'persona'     => $m->persona_nombre,
            'persona_ci'  => $m->persona_ci,
            'forma_pago'  => $m->forma_pago,
            'banco'       => $m->banco?->nombre,
            'documento'   => $m->nro_documento,
            'glosa'       => $m->glosa,
            'monto'       => $m->monto,
            'estado'      => $m->estado,
        ])->all();
    }
}
