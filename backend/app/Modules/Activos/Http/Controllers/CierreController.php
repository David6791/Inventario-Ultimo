<?php

namespace App\Modules\Activos\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Activos\Models\Cierre;
use App\Modules\Activos\Models\PruebaValorRecuperable;
use App\Modules\Activos\Models\Valuacion;
use App\Modules\Activos\Services\CierreMensualService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class CierreController extends Controller
{
    public function __construct(private readonly CierreMensualService $cierres)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $cierres = Cierre::query()
            ->orderByDesc('periodo')
            ->limit($request->integer('limite', 24))
            ->get()
            ->map(fn ($c) => $this->resumir($c));

        return response()->json(['data' => $cierres]);
    }

    public function show(Cierre $cierre): JsonResponse
    {
        return response()->json(['data' => $this->resumir($cierre, true)]);
    }

    public function abrir(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'periodo'     => ['required', 'date'],
            'ufv_inicial' => ['required', 'numeric', 'min:0.00001'],
            'ufv_final'   => ['required', 'numeric', 'min:0.00001'],
        ]);

        try {
            $cierre = $this->cierres->abrir(
                $datos['periodo'], (float) $datos['ufv_inicial'],
                (float) $datos['ufv_final'], $request->user()->id
            );
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }

        return response()->json(['data' => $this->resumir($cierre)], 201);
    }

    public function calcular(Cierre $cierre, Request $request): JsonResponse
    {
        abort_unless($request->user()->can('activos-valuacion.calcular'), 403,
            'Necesita el permiso «activos-valuacion.calcular».');

        try {
            $cierre = $this->cierres->calcular($cierre, $request->user()->id);
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }

        return response()->json([
            'data'    => $this->resumir($cierre),
            'mensaje' => "Período {$cierre->etiqueta} calculado. Revise antes de cerrar.",
        ]);
    }

    /**
     * Cerrar es un acto distinto de calcular, y de otra persona: la matriz de
     * segregación separa a quien ejecuta el cálculo de quien lo aprueba.
     */
    public function cerrar(Cierre $cierre, Request $request): JsonResponse
    {
        abort_unless($request->user()->can('activos-valuacion.cerrar'), 403,
            'Necesita el permiso «activos-valuacion.cerrar».');

        $request->validate(['comprobante' => ['nullable', 'string', 'max:40']]);

        try {
            $cierre = $this->cierres->cerrar(
                $cierre, $request->user()->id, $request->input('comprobante')
            );
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }

        return response()->json([
            'data'    => $this->resumir($cierre),
            'mensaje' => "Período {$cierre->etiqueta} cerrado.",
        ]);
    }

    public function reabrir(Cierre $cierre, Request $request): JsonResponse
    {
        abort_unless($request->user()->can('activos-valuacion.reabrir'), 403,
            'Necesita el permiso «activos-valuacion.reabrir».');

        try {
            $cierre = $this->cierres->reabrir($cierre);
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }

        return response()->json([
            'data'    => $this->resumir($cierre),
            'mensaje' => 'Período reabierto. Las valuaciones fueron borradas.',
        ]);
    }

    /** Detalle por activo: es el auxiliar que concilia con el mayor. */
    public function detalle(Cierre $cierre, Request $request): JsonResponse
    {
        $tipo = $request->string('tipo', Valuacion::FINANCIERA);

        $filas = Valuacion::where('cierre_id', $cierre->id)
            ->where('tipo', $tipo)
            ->with('activo:id,codigo,denominacion,clase_id')
            ->get()
            ->map(fn ($v) => [
                'activo_id'          => $v->activo_id,
                'codigo'             => $v->activo?->codigo,
                'denominacion'       => $v->activo?->denominacion,
                'valor_base_inicial' => (float) $v->valor_base_inicial,
                'actualizacion'      => (float) $v->actualizacion,
                'incremento_mejora'  => (float) $v->incremento_mejora,
                'ajuste_limite'      => (float) $v->ajuste_valor_recuperable,
                'valor_base_final'   => (float) $v->valor_base_final,
                'dep_acum_inicial'   => (float) $v->dep_acum_inicial,
                'dep_actualizacion'  => (float) $v->dep_actualizacion,
                'dep_periodo'        => (float) $v->dep_periodo,
                'dep_acum_final'     => (float) $v->dep_acum_final,
                'valor_neto'         => (float) $v->valor_neto,
                'meses_depreciados'  => $v->meses_depreciados,
                'vida_util_meses'    => $v->vida_util_meses,
            ]);

        return response()->json(['data' => $filas]);
    }

    /**
     * Conciliación financiera contra impositiva.
     * Es lo que el contador lleva a la determinación del IUE.
     */
    public function conciliacion(Cierre $cierre): JsonResponse
    {
        $financieras = Valuacion::where('cierre_id', $cierre->id)
            ->financiera()->with('activo:id,codigo,denominacion')->get()->keyBy('activo_id');

        $impositivas = Valuacion::where('cierre_id', $cierre->id)
            ->impositiva()->get()->keyBy('activo_id');

        $filas = $financieras->map(function ($f) use ($impositivas) {
            $i = $impositivas->get($f->activo_id);

            $deducible = $i ? $i->dep_deducible : 0.0;

            return [
                'codigo'          => $f->activo?->codigo,
                'denominacion'    => $f->activo?->denominacion,
                'dep_financiera'  => (float) $f->dep_periodo,
                'dep_impositiva'  => $i ? (float) $i->dep_periodo : 0.0,
                'no_deducible'    => $i ? (float) $i->dep_periodo_no_deducible : 0.0,
                'dep_deducible'   => $deducible,
                'diferencia'      => round((float) $f->dep_periodo - $deducible, 2),
            ];
        })->values();

        return response()->json([
            'data' => $filas,
            'resumen' => [
                'dep_financiera' => round($filas->sum('dep_financiera'), 2),
                'dep_deducible'  => round($filas->sum('dep_deducible'), 2),
                'no_deducible'   => round($filas->sum('no_deducible'), 2),
                'diferencia'     => round($filas->sum('diferencia'), 2),
            ],
        ]);
    }

    /** Registra la prueba del límite de la NC 3 para un activo. */
    public function registrarValorRecuperable(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('activos-valuacion.valor-recuperable'), 403,
            'Necesita el permiso «activos-valuacion.valor-recuperable».');

        $datos = $request->validate([
            'activo_id'             => ['required', 'integer'],
            'periodo'               => ['required', 'date'],
            'valor_actualizado_ufv' => ['required', 'numeric', 'min:0'],
            'valor_recuperable'     => ['required', 'numeric', 'min:0'],
            'metodo'                => ['required', 'in:' . implode(',', PruebaValorRecuperable::METODOS)],
            'respaldo'              => ['nullable', 'string', 'max:250'],
        ]);

        $prueba = PruebaValorRecuperable::updateOrCreate(
            ['activo_id' => $datos['activo_id'], 'periodo' => $datos['periodo']],
            array_merge($datos, [
                'valor_adoptado' => min($datos['valor_actualizado_ufv'], $datos['valor_recuperable']),
                'registrado_por' => $request->user()->id,
            ])
        );

        return response()->json([
            'data' => $prueba,
            'mensaje' => $prueba->huboAjuste()
                ? 'Registrada. El valor actualizado excede el recuperable: se recortará al calcular.'
                : 'Registrada. El valor actualizado está dentro del límite.',
        ], 201);
    }

    private function resumir(Cierre $c, bool $detallado = false): array
    {
        $base = [
            'id'                  => $c->id,
            'periodo'             => $c->periodo->toDateString(),
            'etiqueta'            => $c->etiqueta,
            'estado'              => $c->estado,
            'ufv_inicial'         => (float) $c->ufv_inicial,
            'ufv_final'           => (float) $c->ufv_final,
            'factor'              => round($c->factor(), 8),
            'variacion_porcentual'=> $c->variacion_porcentual,
            'activos_procesados'  => $c->activos_procesados,
            'total_actualizacion' => (float) $c->total_actualizacion,
            'total_dep_financiera'=> (float) $c->total_dep_financiera,
            'total_dep_fiscal'    => (float) $c->total_dep_fiscal,
            'total_no_deducible'  => (float) $c->total_no_deducible,
            'comprobante_contable'=> $c->comprobante_contable,
        ];

        if ($detallado) {
            $base['trazabilidad'] = [
                'calculado_por' => $c->calculado_por,
                'calculado_at'  => $c->calculado_at?->toIso8601String(),
                'cerrado_por'   => $c->cerrado_por,
                'cerrado_at'    => $c->cerrado_at?->toIso8601String(),
            ];
        }

        return $base;
    }
}
