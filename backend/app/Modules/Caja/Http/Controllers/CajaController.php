<?php

namespace App\Modules\Caja\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Almacen;
use App\Modules\Caja\Http\Requests\CajaRequest;
use App\Modules\Caja\Http\Requests\VistaPreviaCajaRequest;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Concepto;
use App\Modules\Caja\Models\Movimiento;
use App\Modules\Caja\Services\CajaService;
use App\Modules\Comun\Models\Banco;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Cajas por sede: alta y edición (caja.administrar) y la vista de operación,
 * con la sesión abierta, su saldo por moneda y sus movimientos.
 */
class CajaController extends Controller
{
    use AmbitoDeCaja;

    public function __construct(private readonly CajaService $cajas)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $cajas = Caja::query()
            ->delAmbitoDe($request->user())
            ->with(['almacen:id,codigo,nombre', 'sesionAbierta.abiertaPor:id,name'])
            ->orderByDesc('activa')
            ->orderBy('codigo')
            ->get()
            ->map(function (Caja $caja) {
                $sesion = $caja->sesionAbierta;

                return [
                    ...$caja->toArray(),
                    'tiene_sesiones'  => $caja->tieneSesiones(),
                    'proximo_numero'  => $this->cajas->vistaPrevia($caja->only(['codigo', 'formato_comprobante', 'reinicio_comprobante']), $caja)['numero'],
                    'sesion_abierta'  => $sesion ? [
                        'id'          => $sesion->id,
                        'numero'      => $sesion->numero,
                        'abierta_en'  => $sesion->abierta_en,
                        'abierta_por' => $sesion->abiertaPor?->name,
                        'saldos'      => $this->cajas->resumen($sesion),
                    ] : null,
                ];
            });

        return response()->json(['data' => $cajas]);
    }

    /** Vista de operación de una caja. */
    public function show(Caja $caja): JsonResponse
    {
        $this->asegurarAmbito($caja);

        $caja->load(['almacen:id,codigo,nombre', 'sesionAbierta.abiertaPor:id,name']);
        $sesion = $caja->sesionAbierta;

        $ultima = $caja->sesiones()
            ->where('estado', '<>', 'ABIERTA')
            ->with('cerradaPor:id,name')
            ->orderByDesc('numero')
            ->first();

        return response()->json(['data' => [
            ...$caja->toArray(),
            'saldos_arranque' => $this->cajas->saldosDeArranque($caja),
            'ultima_cerrada'  => $ultima ? [
                'id'          => $ultima->id,
                'numero'      => $ultima->numero,
                'estado'      => $ultima->estado,
                'cerrada_en'  => $ultima->cerrada_en,
                'cerrada_por' => $ultima->cerradaPor?->name,
            ] : null,
            'sesion_abierta'  => $sesion ? [
                'id'          => $sesion->id,
                'numero'      => $sesion->numero,
                'abierta_en'  => $sesion->abierta_en,
                'abierta_por' => $sesion->abiertaPor?->name,
                'saldos'      => $this->cajas->resumen($sesion),
                'movimientos' => $sesion->movimientos()
                    ->with(['concepto:id,codigo,nombre,tipo,origen', 'banco:id,nombre',
                            'registradoPor:id,name', 'anuladoPor:id,name'])
                    ->orderByDesc('id')
                    ->get(),
            ] : null,
        ]]);
    }

    public function store(CajaRequest $request): JsonResponse
    {
        $caja = $this->cajas->crearCaja($request->validated());

        return response()->json(['data' => $caja->load('almacen:id,codigo,nombre')], 201);
    }

    public function update(CajaRequest $request, Caja $caja): JsonResponse
    {
        $caja = $this->cajas->actualizarCaja($caja, $request->validated());

        return response()->json(['data' => $caja->load('almacen:id,codigo,nombre')]);
    }

    /** Vista previa en vivo del formato del comprobante. Nunca guarda ni consume números. */
    public function vistaPrevia(VistaPreviaCajaRequest $request): JsonResponse
    {
        $caja = $request->filled('caja_id') ? Caja::find($request->integer('caja_id')) : null;

        return response()->json(['data' => $this->cajas->vistaPrevia(
            $request->only(['codigo', 'formato_comprobante', 'reinicio_comprobante']),
            $caja,
            $request->input('fecha'),
        )]);
    }

    /** Listas cerradas para los formularios de caja. */
    public function opciones(Request $request): JsonResponse
    {
        $usuario = $request->user();

        $almacenes = Almacen::query()
            ->where('activo', true)
            ->when(! $usuario->can('caja.administrar') && ! $usuario->can('almacenes.ver-todos'),
                fn ($q) => $q->whereIn('id', $usuario->almacenesIds()))
            ->orderBy('nombre')
            ->get(['id', 'codigo', 'nombre']);

        return response()->json(['data' => [
            'almacenes'   => $almacenes,
            'bancos'      => Banco::activos()->orderBy('nombre')->get(['id', 'nombre']),
            'monedas'     => [['valor' => 'BOB', 'etiqueta' => 'Bolivianos (Bs)'], ['valor' => 'USD', 'etiqueta' => 'Dólares (US$)']],
            'formas_pago' => array_map(fn ($f) => ['valor' => $f, 'etiqueta' => ucfirst(mb_strtolower($f))], Movimiento::FORMAS_PAGO),
            'tipos'       => [['valor' => 'INGRESO', 'etiqueta' => 'Ingreso'], ['valor' => 'EGRESO', 'etiqueta' => 'Egreso']],
            'reinicios'   => [
                ['valor' => 'NUNCA',   'etiqueta' => 'Nunca (correlativo continuo)'],
                ['valor' => 'ANUAL',   'etiqueta' => 'Cada año'],
                ['valor' => 'MENSUAL', 'etiqueta' => 'Cada mes'],
                ['valor' => 'DIARIO',  'etiqueta' => 'Cada día'],
            ],
            'marcadores'  => collect(Caja::MARCADORES)->map(fn ($d, $m) => ['marcador' => $m, 'descripcion' => $d])->values(),
            'conceptos'   => Concepto::query()
                ->where('origen', Concepto::MANUAL)
                ->where('activo', true)
                ->orderBy('nombre')
                ->get(['id', 'codigo', 'nombre', 'tipo']),
        ]]);
    }
}
