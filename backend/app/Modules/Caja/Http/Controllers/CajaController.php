<?php

namespace App\Modules\Caja\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Enums\Permisos;
use App\Models\Almacen;
use App\Models\User;
use App\Modules\Caja\Http\Requests\CajerosRequest;
use App\Modules\Caja\Http\Requests\CajaRequest;
use App\Modules\Caja\Http\Requests\VistaPreviaCajaRequest;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Concepto;
use App\Modules\Caja\Models\Movimiento;
use App\Modules\Caja\Services\CajaService;
use App\Modules\Caja\Services\SolicitudService;
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

    public function __construct(
        private readonly CajaService $cajas,
        private readonly SolicitudService $solicitudes,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $cajas = Caja::query()
            ->delAmbitoDe($request->user())
            ->with(['almacen:id,codigo,nombre', 'almacen.centroCosto:id,almacen_id,codigo,nombre,es_acopio,es_central', 'sesionAbierta.abiertaPor:id,name', 'cajeros:id,name', 'aprobadores:id,name'])
            ->withCount(['solicitudes as solicitudes_por_pagar' => fn ($q) => $q->where('estado', 'APROBADA')])
            ->orderByDesc('activa')
            ->orderBy('codigo')
            ->get()
            ->map(function (Caja $caja) use ($request) {
                $sesion = $caja->sesionAbierta;

                return [
                    ...$caja->toArray(),
                    'cajeros'         => $this->cajeros($caja),
                    'aprobadores'     => $this->usuariosDe($caja->aprobadores),
                    'soy_cajero'      => $caja->cajeros->contains('id', $request->user()->id),
                    'tiene_sesiones'  => $caja->tieneSesiones(),
                    // Envíos de la sede central que esperan que esta caja los reciba.
                    'envios_por_recibir' => \App\Modules\Caja\Models\EnvioFondos::where('caja_destino_id', $caja->id)
                        ->where('estado', 'EN_TRANSITO')->count(),
                    'es_central'      => (bool) $caja->almacen?->centroCosto?->es_central,
                    'ultimo_correlativo' => $this->solicitudes->ultimoComprobante($caja, $caja->numeracion_separada ? 'EGRESO' : null),
                    'ultimo_correlativo_ingreso' => $caja->numeracion_separada ? $this->solicitudes->ultimoComprobante($caja, 'INGRESO') : null,
                    'proximo_numero_ingreso' => $caja->numeracion_separada ? $this->solicitudes->proximoComprobante($caja, 'INGRESO') : null,
                    'proximo_numero'  => $this->solicitudes->proximoComprobante($caja, $caja->numeracion_separada ? 'EGRESO' : null),
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
    public function show(Request $request, Caja $caja): JsonResponse
    {
        $this->asegurarAmbito($caja);

        $caja->load(['almacen:id,codigo,nombre', 'almacen.centroCosto:id,almacen_id,codigo,nombre,es_acopio,es_central', 'sesionAbierta.abiertaPor:id,name', 'cajeros:id,name', 'aprobadores:id,name']);
        $caja->loadCount(['solicitudes as solicitudes_por_pagar' => fn ($q) => $q->where('estado', 'APROBADA')]);
        $sesion = $caja->sesionAbierta;

        $ultima = $caja->sesiones()
            ->where('estado', '<>', 'ABIERTA')
            ->with('cerradaPor:id,name')
            ->orderByDesc('numero')
            ->first();

        return response()->json(['data' => [
            ...$caja->toArray(),
            'cajeros'         => $this->cajeros($caja),
            'aprobadores'     => $this->usuariosDe($caja->aprobadores),
            'soy_cajero'      => $caja->cajeros->contains('id', $request->user()->id),
            'es_central'      => $caja->esCentral(),
            'envios_por_recibir' => \App\Modules\Caja\Models\EnvioFondos::where('caja_destino_id', $caja->id)->where('estado', 'EN_TRANSITO')->count(),
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
                            'registradoPor:id,name', 'anuladoPor:id,name', 'persona:id,nombre,ci', 'validadoPor:id,name',
                            'ajustes.registradoPor:id,name', 'ajustes.resueltoPor:id,name', 'ajustes.aplicadoPor:id,name'])
                    ->orderByDesc('id')
                    ->get(),
            ] : null,
        ]]);
    }

    public function store(CajaRequest $request): JsonResponse
    {
        $caja = $this->cajas->crearCaja($request->datosCaja());
        $this->fijarNumeracion($request, $caja);

        return response()->json(['data' => $caja->load('almacen:id,codigo,nombre')], 201);
    }

    public function update(CajaRequest $request, Caja $caja): JsonResponse
    {
        $caja = $this->cajas->actualizarCaja($caja, $request->datosCaja());
        $this->fijarNumeracion($request, $caja);

        return response()->json(['data' => $caja->load('almacen:id,codigo,nombre')]);
    }

    /** Cajeros asignados: solo ellos operan la caja. Reemplaza la lista completa. */
    public function cajerosActualizar(CajerosRequest $request, Caja $caja): JsonResponse
    {
        $this->cajas->asignarCajeros($caja, $request->input('usuarios', []), $request->user());

        return response()->json([
            'data'    => $this->cajeros($caja->load('cajeros:id,name')),
            'mensaje' => "Cajeros de la caja {$caja->codigo} actualizados.",
        ]);
    }

    /** Aprobadores de las solicitudes de dinero. Reemplaza la lista completa. */
    public function aprobadoresActualizar(CajerosRequest $request, Caja $caja): JsonResponse
    {
        $this->cajas->asignarAprobadores($caja, $request->input('usuarios', []), $request->user());

        return response()->json([
            'data'    => $this->usuariosDe($caja->load('aprobadores:id,name')->aprobadores),
            'mensaje' => "Aprobadores de la caja {$caja->codigo} actualizados.",
        ]);
    }

    /** Vista previa en vivo del formato del comprobante. Nunca guarda ni consume números. */
    public function vistaPrevia(VistaPreviaCajaRequest $request): JsonResponse
    {
        $caja = $request->filled('caja_id') ? Caja::find($request->integer('caja_id')) : null;

        $previa = $this->cajas->vistaPrevia(
            $request->only(['codigo', 'formato_comprobante', 'reinicio_comprobante']),
            $caja,
            $request->input('fecha'),
            $request->filled('proximo_comprobante') ? $request->integer('proximo_comprobante') : null,
        );

        // Numeración separada: también cómo saldrá el próximo ingreso.
        if ($request->boolean('numeracion_separada')) {
            $previa['ingreso'] = $this->cajas->vistaPrevia(
                ['codigo' => $request->input('codigo'), 'reinicio_comprobante' => $request->input('reinicio_comprobante'),
                 'formato_comprobante' => $request->input('formato_ingreso') ?: $request->input('formato_comprobante')],
                $caja,
                $request->input('fecha'),
                $request->filled('proximo_ingreso') ? $request->integer('proximo_ingreso') : null,
            );
        }

        return response()->json(['data' => $previa]);
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

        // Para asignar cajeros: usuarios activos que pueden abrir o registrar en caja.
        $usuarios = $usuario->can('caja.administrar')
            ? User::query()
                ->where('activo', true)
                ->where(fn ($q) => $q
                    ->where(fn ($p) => $p->permission(['caja.abrir', 'caja.registrar']))
                    ->orWhereHas('roles', fn ($r) => $r->where('name', Permisos::SUPER_ADMIN)))
                ->orderBy('name')
                ->get(['id', 'name', 'email'])
            : [];

        // Para asignar aprobadores: usuarios activos con caja.aprobar.
        $aprobadores = $usuario->can('caja.administrar')
            ? User::query()
                ->where('activo', true)
                ->where(fn ($q) => $q
                    ->where(fn ($p) => $p->permission(['caja.aprobar']))
                    ->orWhereHas('roles', fn ($r) => $r->where('name', Permisos::SUPER_ADMIN)))
                ->orderBy('name')
                ->get(['id', 'name', 'email'])
            : [];

        return response()->json(['data' => [
            'almacenes'   => $almacenes,
            'usuarios'    => $usuarios,
            'aprobadores' => $aprobadores,
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
            'denominaciones' => \App\Modules\Caja\Models\Sesion::DENOMINACIONES,
            'marcadores'  => collect(Caja::MARCADORES)->map(fn ($d, $m) => ['marcador' => $m, 'descripcion' => $d])->values(),
            'conceptos'   => Concepto::query()
                ->where('origen', Concepto::MANUAL)
                ->where('activo', true)
                ->orderBy('nombre')
                ->get(['id', 'codigo', 'nombre', 'tipo', 'exento_aprobacion']),
        ]]);
    }

    /** Si el formulario indicó desde qué número sigue el comprobante, se fija. */
    private function fijarNumeracion(CajaRequest $request, Caja $caja): void
    {
        $separada = $caja->numeracion_separada;
        if ($request->filled('proximo_comprobante')) {
            $this->solicitudes->fijarProximoComprobante(
                $caja, $request->integer('proximo_comprobante'), $request->user(), $request->input('motivo_numeracion'),
                $separada ? 'EGRESO' : null
            );
        }
        if ($separada && $request->filled('proximo_ingreso')) {
            $this->solicitudes->fijarProximoComprobante(
                $caja, $request->integer('proximo_ingreso'), $request->user(), $request->input('motivo_numeracion'), 'INGRESO'
            );
        }
    }

    private function usuariosDe($usuarios): array
    {
        return $usuarios->sortBy('name')->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name])->values()->all();
    }

    private function cajeros(Caja $caja): array
    {
        return $caja->cajeros
            ->sortBy('name')
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name])
            ->values()
            ->all();
    }
}
