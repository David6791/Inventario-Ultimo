<?php

namespace App\Http\Controllers\Api;

use App\Enums\EstadoDocumento;
use App\Http\Controllers\Controller;
use App\Http\Requests\IngresoRequest;
use App\Http\Resources\IngresoResource;
use App\Models\Almacen;
use App\Models\Ingreso;
use App\Models\SolicitudCompra;
use App\Models\SolicitudCompraDetalle;
use App\Services\MovimientoService;
use App\Services\NumeradorService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Notas de ingreso.
 *
 * Siempre nacen de una solicitud de compra aprobada. Al confirmar: sube el
 * stock, se crea la capa de costo PEPS, se escribe el kardex, se descuenta el
 * saldo pendiente de la solicitud y se recalcula su estado.
 *
 * Si el proveedor entregó parte, la solicitud queda "atendida en parte" y un
 * segundo ingreso la cierra.
 */
class IngresoController extends Controller
{
    public function __construct(
        private NumeradorService $numerador,
        private MovimientoService $movimientos,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('ingresos.ver'), 403);

        $ingresos = Ingreso::query()
            ->with(['almacen:id,nombre', 'solicitud:id,numero', 'registradoPor:id,name'])
            ->withCount('detalles')
            ->when($request->filled('estado'), fn ($q) => $q->where('estado', $request->string('estado')))
            ->when($request->boolean('sin_respaldo'), fn ($q) => $q->sinRespaldo())
            ->when($request->filled('solicitud_id'),
                fn ($q) => $q->where('solicitud_compra_id', $request->integer('solicitud_id')))
            ->when($request->filled('buscar'), function ($q) use ($request) {
                $texto = '%'.$request->string('buscar').'%';
                $q->where(fn ($s) => $s->where('numero', 'ilike', $texto)
                    ->orWhere('proveedor', 'ilike', $texto)
                    ->orWhere('numero_documento', 'ilike', $texto));
            })
            ->when($request->filled('desde'), fn ($q) => $q->whereDate('fecha', '>=', $request->date('desde')))
            ->when($request->filled('hasta'), fn ($q) => $q->whereDate('fecha', '<=', $request->date('hasta')))
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->paginate($request->integer('por_pagina', 20))
            ->withQueryString();

        return IngresoResource::collection($ingresos);
    }

    public function show(Request $request, Ingreso $ingreso): IngresoResource
    {
        abort_unless($request->user()->can('ingresos.ver'), 403);

        return new IngresoResource($ingreso->load($this->relaciones()));
    }

    /**
     * Solicitudes de compra listas para recibir, con sus saldos pendientes.
     * Es lo que alimenta el selector al crear un ingreso.
     */
    public function pendientes(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('ingresos.registrar'), 403);

        $solicitudes = SolicitudCompra::query()
            ->pendientes()
            ->with(['detalles.producto:id,codigo,nombre,unidad_medida_id,controla_lote,controla_vencimiento',
                    'detalles.producto.unidadMedida:id,codigo,permite_decimales'])
            ->orderBy('fecha')
            ->get()
            // Una solicitud sin saldo no debería aparecer aunque su estado no se
            // haya recalculado todavía.
            ->filter(fn ($s) => $s->detalles->contains(fn ($d) => $d->saldo() > 0));

        return response()->json([
            'data' => $solicitudes->values()->map(fn ($s) => [
                'id'                 => $s->id,
                'numero'             => $s->numero,
                'fecha'              => $s->fecha?->toDateString(),
                'unidad_solicitante' => $s->unidad_solicitante,
                'estado_etiqueta'    => $s->estado->etiqueta(),
                'detalles' => $s->detalles
                    ->filter(fn ($d) => $d->saldo() > 0)
                    ->values()
                    ->map(fn ($d) => [
                        'solicitud_compra_detalle_id' => $d->id,
                        'producto_id'          => $d->producto_id,
                        'codigo'               => $d->producto?->codigo,
                        'producto'             => $d->producto?->nombre,
                        'unidad'               => $d->producto?->unidadMedida?->codigo,
                        'permite_decimales'    => (bool) $d->producto?->unidadMedida?->permite_decimales,
                        'controla_lote'        => (bool) $d->producto?->controla_lote,
                        'controla_vencimiento' => (bool) $d->producto?->controla_vencimiento,
                        'cantidad_solicitada'  => (float) $d->cantidad,
                        'saldo'                => $d->saldo(),
                        'especificacion'       => $d->especificacion,
                    ]),
            ]),
        ]);
    }

    public function store(IngresoRequest $request): JsonResponse
    {
        abort_unless($request->user()->can('ingresos.registrar'), 403);

        $almacenId = (int) app('almacen_actual');

        $ingreso = DB::transaction(function () use ($request, $almacenId) {
            $almacen = Almacen::findOrFail($almacenId);

            $ingreso = Ingreso::create([
                'numero' => $this->numerador->siguiente(
                    $almacenId, Ingreso::TIPO_CONTADOR, Ingreso::PREFIJO, $almacen->codigo,
                ),
                'almacen_id'          => $almacenId,
                'solicitud_compra_id' => $request->integer('solicitud_compra_id'),
                'fecha'               => $request->date('fecha'),
                'proveedor'           => $request->string('proveedor')->trim()->value(),
                'tipo_documento'      => $request->string('tipo_documento')->value(),
                'numero_documento'    => $request->input('numero_documento'),
                'fecha_documento'     => $request->input('fecha_documento'),
                'observaciones'       => $request->input('observaciones'),
                'estado'              => EstadoDocumento::Borrador->value,
                'registrado_por'      => $request->user()->id,
            ]);

            $this->guardarDetalles($ingreso, $request->input('detalles'));

            return $ingreso;
        });

        return response()->json(new IngresoResource($ingreso->load($this->relaciones())), 201);
    }

    public function update(IngresoRequest $request, Ingreso $ingreso): IngresoResource
    {
        abort_unless($request->user()->can('ingresos.editar'), 403);

        abort_unless(
            $ingreso->estado->esEditable(),
            409,
            'Solo se puede modificar un ingreso en borrador. Una vez confirmado ya movió existencias.'
        );

        DB::transaction(function () use ($request, $ingreso) {
            $ingreso->update([
                'fecha'            => $request->date('fecha'),
                'proveedor'        => $request->string('proveedor')->trim()->value(),
                'tipo_documento'   => $request->string('tipo_documento')->value(),
                'numero_documento' => $request->input('numero_documento'),
                'fecha_documento'  => $request->input('fecha_documento'),
                'observaciones'    => $request->input('observaciones'),
            ]);

            $ingreso->detalles()->delete();
            $this->guardarDetalles($ingreso, $request->input('detalles'));
        });

        return new IngresoResource($ingreso->fresh()->load($this->relaciones()));
    }

    public function destroy(Request $request, Ingreso $ingreso): JsonResponse
    {
        abort_unless($request->user()->can('ingresos.editar'), 403);

        abort_unless(
            $ingreso->estado->esEditable(),
            409,
            'Solo se puede eliminar un borrador. Un ingreso confirmado se anula.'
        );

        $ingreso->delete();

        return response()->json(['mensaje' => 'Borrador eliminado.']);
    }

    /**
     * Confirma la recepción: crea las capas de costo, sube el stock, escribe el
     * kardex y descuenta el saldo de la solicitud.
     */
    public function confirmar(Request $request, Ingreso $ingreso): IngresoResource
    {
        abort_unless($request->user()->can('ingresos.confirmar'), 403);

        abort_unless(
            $ingreso->estado === EstadoDocumento::Borrador,
            409,
            'Este ingreso ya fue confirmado o anulado.'
        );

        $ingreso->load(['detalles.producto:id,nombre', 'solicitud']);

        abort_if($ingreso->detalles->isEmpty(), 409, 'El ingreso no tiene detalle.');

        DB::transaction(function () use ($ingreso, $request) {
            foreach ($ingreso->detalles as $linea) {
                $this->movimientos->registrarIngreso(
                    $linea->producto_id,
                    $ingreso->almacen_id,
                    (float) $linea->cantidad,
                    (float) $linea->costo_unitario,
                    $ingreso,
                    Ingreso::TIPO_DOCUMENTO,
                    $request->user()->id,
                    $linea->id,
                    $linea->lote,
                    $linea->fecha_vencimiento?->toDateString(),
                    $linea->observacion,
                );

                // Descuenta el saldo pendiente de la línea de la solicitud.
                SolicitudCompraDetalle::where('id', $linea->solicitud_compra_detalle_id)
                    ->increment('cantidad_atendida', (float) $linea->cantidad);
            }

            $ingreso->update([
                'estado'         => EstadoDocumento::Confirmada->value,
                'confirmada_en'  => now(),
                'confirmada_por' => $request->user()->id,
            ]);

            // La solicitud pasa a atendida o atendida en parte según los saldos.
            $ingreso->solicitud?->recalcularEstado();
        });

        return new IngresoResource($ingreso->fresh()->load($this->relaciones()));
    }

    /**
     * Anula un ingreso confirmado.
     *
     * Falla si la mercadería ya salió: revertir una capa consumida dejaría el
     * costeo descuadrado. Primero hay que anular las salidas.
     */
    public function anular(Request $request, Ingreso $ingreso): IngresoResource
    {
        abort_unless($request->user()->can('ingresos.anular'), 403);

        $request->validate(['motivo' => ['required', 'string', 'max:300']]);

        abort_unless(
            $ingreso->estado === EstadoDocumento::Confirmada,
            409,
            'Solo se anula un ingreso confirmado. Un borrador se elimina.'
        );

        $ingreso->load(['detalles', 'solicitud']);

        try {
            DB::transaction(function () use ($ingreso, $request) {
                foreach ($ingreso->detalles as $linea) {
                    $this->movimientos->revertirIngreso(
                        $linea->id,
                        $linea->producto_id,
                        $ingreso->almacen_id,
                        (float) $linea->cantidad,
                        $ingreso,
                        Ingreso::TIPO_DOCUMENTO,
                        $request->user()->id,
                        $request->string('motivo')->value(),
                    );

                    SolicitudCompraDetalle::where('id', $linea->solicitud_compra_detalle_id)
                        ->decrement('cantidad_atendida', (float) $linea->cantidad);
                }

                $ingreso->update([
                    'estado'           => EstadoDocumento::Anulada->value,
                    'motivo_anulacion' => $request->string('motivo')->value(),
                    'anulada_en'       => now(),
                    'anulada_por'      => $request->user()->id,
                ]);

                $ingreso->solicitud?->recalcularEstado();
            });
        } catch (RuntimeException $e) {
            abort(409, 'No se pudo anular. '.$e->getMessage());
        }

        return new IngresoResource($ingreso->fresh()->load($this->relaciones()));
    }

    /** Sube la factura o nota de entrega escaneada. */
    public function subirRespaldo(Request $request, Ingreso $ingreso): IngresoResource
    {
        abort_unless($request->user()->can('ingresos.confirmar'), 403);

        $request->validate([
            'respaldo' => ['required', 'file', 'mimes:pdf', 'max:10240'],
        ], [
            'respaldo.required' => 'Adjunte el documento del proveedor en PDF.',
            'respaldo.mimes'    => 'El respaldo debe ser un archivo PDF.',
            'respaldo.max'      => 'El respaldo no puede superar los 10 MB.',
        ]);

        abort_unless(
            $ingreso->estado === EstadoDocumento::Confirmada,
            409,
            'Solo se adjunta respaldo a un ingreso confirmado.'
        );

        $archivo = $request->file('respaldo');

        $ruta = $archivo->storeAs(
            'ingresos/'.$ingreso->fecha->format('Y'),
            str_replace('/', '-', $ingreso->numero).'.pdf',
            'local'
        );

        // storeAs() devuelve false si no puede escribir y no lanza excepción.
        abort_if(
            $ruta === false,
            500,
            'No se pudo guardar el archivo en el servidor. Revise los permisos de la carpeta storage.'
        );

        $ingreso->update([
            'respaldo_ruta'      => $ruta,
            'respaldo_nombre'    => $archivo->getClientOriginalName(),
            'respaldo_subido_en' => now(),
        ]);

        return new IngresoResource($ingreso->fresh()->load($this->relaciones()));
    }

    public function respaldo(Request $request, Ingreso $ingreso): StreamedResponse
    {
        abort_unless($request->user()->can('ingresos.ver'), 403);
        abort_unless($ingreso->respaldo_ruta, 404, 'Este ingreso no tiene respaldo adjunto.');

        return Storage::disk('local')->download(
            $ingreso->respaldo_ruta,
            $ingreso->respaldo_nombre ?? "{$ingreso->numero}.pdf"
        );
    }

    /** El acta de recepción para imprimir y hacer firmar. */
    public function pdf(Request $request, Ingreso $ingreso): Response
    {
        abort_unless($request->user()->can('ingresos.ver'), 403);

        $pdf = Pdf::loadView('pdf.nota-ingreso', [
            'ingreso'     => $ingreso->load($this->relaciones()),
            'institucion' => config('app.name'),
        ])->setPaper('letter');

        return $pdf->stream(str_replace('/', '-', $ingreso->numero).'.pdf');
    }

    private function relaciones(): array
    {
        return [
            'almacen:id,nombre',
            'solicitud:id,numero',
            'registradoPor:id,name',
            'confirmadaPor:id,name',
            'detalles.producto:id,codigo,nombre,unidad_medida_id',
            'detalles.producto.unidadMedida:id,codigo',
        ];
    }

    private function guardarDetalles(Ingreso $ingreso, array $detalles): void
    {
        $lineas = SolicitudCompraDetalle::whereIn(
            'id', collect($detalles)->pluck('solicitud_compra_detalle_id')
        )->get()->keyBy('id');

        foreach ($detalles as $linea) {
            $origen = $lineas[$linea['solicitud_compra_detalle_id']] ?? null;

            $ingreso->detalles()->create([
                // El producto se toma de la solicitud, no del cliente: así no
                // puede llegar un producto que no corresponde a esa línea.
                'producto_id' => $origen?->producto_id,
                'solicitud_compra_detalle_id' => $linea['solicitud_compra_detalle_id'],
                'cantidad'          => $linea['cantidad'],
                'costo_unitario'    => $linea['costo_unitario'],
                'lote'              => $linea['lote'] ?? null,
                'fecha_vencimiento' => $linea['fecha_vencimiento'] ?? null,
                'observacion'       => $linea['observacion'] ?? null,
            ]);
        }
    }
}
