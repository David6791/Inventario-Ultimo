<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\TablaPrecioRequest;
use App\Modules\Cargas\Models\Lote;
use App\Modules\Cargas\Models\TablaPrecio;
use App\Modules\Cargas\Services\PrecioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Tablas de precio: borrador, copia, aprobación por otra persona, anulación; y el valor estimado del lote. */
class PrecioController extends Controller
{
    public function __construct(private readonly PrecioService $precios)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $tablas = TablaPrecio::query()
            ->with(['linea:id,codigo,nombre', 'elemento:id,codigo,nombre,unidad_ley', 'creadoPor:id,name', 'aprobadoPor:id,name'])
            ->withCount('tramos')
            ->when($request->filled('linea_id'), fn ($q) => $q->where('linea_producto_id', $request->integer('linea_id')))
            ->when($request->filled('elemento_id'), fn ($q) => $q->where('elemento_id', $request->integer('elemento_id')))
            ->when($request->filled('estado'), fn ($q) => $q->where('estado', $request->query('estado')))
            ->orderBy('linea_producto_id')->orderBy('elemento_id')->orderByDesc('vigente_desde')->orderByDesc('id')
            ->get()
            ->map(fn (TablaPrecio $t) => [...$t->toArray(), 'situacion' => $this->situacion($t)]);

        return response()->json(['data' => $tablas]);
    }

    public function show(TablaPrecio $tabla): JsonResponse
    {
        $tabla->load(['linea:id,codigo,nombre,modalidad_precio', 'elemento:id,codigo,nombre,unidad_ley,unidad_cotizacion',
                      'creadoPor:id,name', 'aprobadoPor:id,name', 'tramos']);

        return response()->json(['data' => [...$tabla->toArray(), 'situacion' => $this->situacion($tabla),
                                            'vista_previa' => $this->precios->vistaPrevia($tabla)]]);
    }

    public function store(TablaPrecioRequest $request): JsonResponse
    {
        $t = $this->precios->guardarBorrador($request->validated(), null, $request->user());

        return response()->json(['data' => $t, 'mensaje' => 'Borrador guardado. Otra persona con permiso de aprobar debe revisarlo.'], 201);
    }

    public function update(TablaPrecioRequest $request, TablaPrecio $tabla): JsonResponse
    {
        abort_unless($tabla->estado === 'BORRADOR', 422, 'Solo se edita un borrador: una tabla aprobada se reemplaza con otra.');
        $t = $this->precios->guardarBorrador($request->validated(), $tabla, $request->user());

        return response()->json(['data' => $t, 'mensaje' => 'Borrador actualizado.']);
    }

    public function copiar(Request $request, TablaPrecio $tabla): JsonResponse
    {
        abort_unless($request->user()->can('cargas.precios-editar'), 403, 'No tiene permiso para armar tablas de precio.');
        $t = $this->precios->copiar($tabla->load('tramos'), $request->user());

        return response()->json(['data' => $t, 'mensaje' => 'Se creó un borrador con los mismos tramos: ajústelo y fije desde cuándo rige.'], 201);
    }

    public function aprobar(Request $request, TablaPrecio $tabla): JsonResponse
    {
        abort_unless($request->user()->can('cargas.precios-aprobar'), 403, 'No tiene permiso para aprobar tablas de precio.');
        abort_if($tabla->creado_por === $request->user()->id, 422, 'La tabla la armó usted: la aprueba otra persona.');
        $t = $this->precios->aprobar($tabla, $request->user());

        return response()->json(['data' => $t, 'mensaje' => 'Tabla aprobada: rige desde el ' . $t->vigente_desde->format('d/m/Y') . '.']);
    }

    public function anular(Request $request, TablaPrecio $tabla): JsonResponse
    {
        $permiso = $tabla->estado === 'BORRADOR' ? 'cargas.precios-editar' : 'cargas.precios-aprobar';
        abort_unless($request->user()->can($permiso), 403);
        $t = $this->precios->anular($tabla, $request->user());

        return response()->json(['data' => $t, 'mensaje' => 'Tabla anulada.']);
    }

    public function destroy(Request $request, TablaPrecio $tabla): JsonResponse
    {
        abort_unless($request->user()->can('cargas.precios-editar'), 403);
        $this->precios->eliminar($tabla, $request->user());

        return response()->json(['mensaje' => 'Borrador eliminado.']);
    }

    /** Valor estimado del lote: peso seco × valor por TM de cada pagable (sin descuentos ni retenciones). */
    public function valorLote(Request $request, Lote $lote): JsonResponse
    {
        abort_unless($lote->esDelAmbitoDe($request->user()), 403, 'El lote es de una sede a la que su usuario no tiene acceso.');

        return response()->json(['data' => [...$this->precios->valorEstimado($lote->id),
                                            'fecha' => $lote->fecha_recepcion->toDateString()]]);
    }

    private function situacion(TablaPrecio $t): string
    {
        $hoy = now()->toDateString();
        if ($t->estado !== 'APROBADA') {
            return $t->estado;
        }
        if ($t->vigente_desde->toDateString() > $hoy) {
            return 'PROXIMA';
        }

        return $t->vigente_hasta && $t->vigente_hasta->toDateString() <= $hoy ? 'ANTERIOR' : 'VIGENTE';
    }
}
