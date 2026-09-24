<?php

namespace App\Http\Controllers\Api;

use App\Enums\EstadoTransferencia;
use App\Http\Controllers\Controller;
use App\Http\Requests\TransferenciaRequest;
use App\Http\Resources\TransferenciaResource;
use App\Models\Almacen;
use App\Models\Transferencia;
use App\Models\TransferenciaCapa;
use App\Services\MovimientoService;
use App\Services\NumeradorService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Traslados entre almacenes, con tránsito.
 *
 * Se despacha del origen y se recibe en el destino, en dos momentos. Entre medio
 * el material no está en ningún almacén: figura solo en la transferencia.
 *
 * Quién puede hacer qué lo decide la membresía de almacén, no un permiso
 * aparte: despacha quien está asignado al origen, recibe quien está asignado al
 * destino. Los dos usan `transferencias.confirmar`.
 */
class TransferenciaController extends Controller
{
    public function __construct(
        private NumeradorService $numerador,
        private MovimientoService $movimientos,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('transferencias.ver'), 403);

        $transferencias = Transferencia::query()
            ->with(['origen:id,nombre', 'destino:id,nombre', 'registradoPor:id,name'])
            ->withCount('detalles')
            ->when($request->filled('estado'), fn ($q) => $q->where('estado', $request->string('estado')))
            ->when($request->boolean('en_transito'), fn ($q) => $q->enTransito())
            // "Las que me llegan": lo que otro almacén me despachó y espera
            // que reciba. Es la bandeja de entrada del almacenero.
            ->when($request->boolean('por_recibir'), function ($q) use ($request) {
                $q->enTransito()
                  ->whereIn('almacen_destino_id', $request->user()->almacenesIds());
            })
            ->when($request->filled('buscar'), function ($q) use ($request) {
                $texto = '%'.$request->string('buscar').'%';
                $q->where(fn ($s) => $s->where('numero', 'ilike', $texto)
                    ->orWhere('transportista', 'ilike', $texto));
            })
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->paginate($request->integer('por_pagina', 20))
            ->withQueryString();

        return TransferenciaResource::collection($transferencias);
    }

    public function show(Request $request, Transferencia $transferencia): TransferenciaResource
    {
        abort_unless($request->user()->can('transferencias.ver'), 403);

        return new TransferenciaResource($transferencia->load($this->relaciones()));
    }

    public function store(TransferenciaRequest $request): JsonResponse
    {
        abort_unless($request->user()->can('transferencias.registrar'), 403);

        $origenId = (int) app('almacen_actual');

        $transferencia = DB::transaction(function () use ($request, $origenId) {
            $almacen = Almacen::findOrFail($origenId);

            $transferencia = Transferencia::create([
                'numero' => $this->numerador->siguiente(
                    $origenId, Transferencia::TIPO_CONTADOR, Transferencia::PREFIJO, $almacen->codigo,
                ),
                'almacen_origen_id'  => $origenId,
                'almacen_destino_id' => $request->integer('almacen_destino_id'),
                'fecha'              => $request->date('fecha'),
                'motivo'             => $request->input('motivo'),
                'transportista'      => $request->input('transportista'),
                'estado'             => EstadoTransferencia::Borrador->value,
                'registrado_por'     => $request->user()->id,
            ]);

            $this->guardarDetalles($transferencia, $request->input('detalles'));

            return $transferencia;
        });

        return response()->json(
            new TransferenciaResource($transferencia->load($this->relaciones())),
            201
        );
    }

    public function update(
        TransferenciaRequest $request,
        Transferencia $transferencia,
    ): TransferenciaResource {
        abort_unless($request->user()->can('transferencias.registrar'), 403);

        abort_unless(
            $transferencia->estado->esEditable(),
            409,
            'Solo se puede modificar una transferencia en borrador.'
        );

        DB::transaction(function () use ($request, $transferencia) {
            $transferencia->update([
                'almacen_destino_id' => $request->integer('almacen_destino_id'),
                'fecha'              => $request->date('fecha'),
                'motivo'             => $request->input('motivo'),
                'transportista'      => $request->input('transportista'),
            ]);

            $transferencia->detalles()->delete();
            $this->guardarDetalles($transferencia, $request->input('detalles'));
        });

        return new TransferenciaResource($transferencia->fresh()->load($this->relaciones()));
    }

    public function destroy(Request $request, Transferencia $transferencia): JsonResponse
    {
        abort_unless($request->user()->can('transferencias.registrar'), 403);

        abort_unless(
            $transferencia->estado->esEditable(),
            409,
            'Solo se puede eliminar un borrador. Una transferencia despachada se anula.'
        );

        $transferencia->delete();

        return response()->json(['mensaje' => 'Borrador eliminado.']);
    }

    /**
     * Despacha: descuenta el origen y pone el material en tránsito.
     *
     * Las capas consumidas quedan anotadas para que el costo viaje: al recibir,
     * el material entra al destino con su precio de origen, no con uno nuevo.
     */
    public function despachar(Request $request, Transferencia $transferencia): TransferenciaResource
    {
        abort_unless($request->user()->can('transferencias.confirmar'), 403);

        abort_unless(
            $request->user()->accedeAlmacen($transferencia->almacen_origen_id),
            403,
            'Solo puede despachar quien esté asignado al almacén de origen.'
        );

        abort_unless(
            $transferencia->estado === EstadoTransferencia::Borrador,
            409,
            'Esta transferencia ya fue despachada o anulada.'
        );

        $transferencia->load('detalles.producto:id,nombre');

        abort_if($transferencia->detalles->isEmpty(), 409, 'La transferencia no tiene detalle.');

        try {
            DB::transaction(function () use ($transferencia, $request) {
                foreach ($transferencia->detalles as $linea) {
                    $resultado = $this->movimientos->despacharTransferencia(
                        $linea->producto_id,
                        $transferencia->almacen_origen_id,
                        (float) $linea->cantidad,
                        $transferencia,
                        $request->user()->id,
                        $linea->observacion,
                    );

                    // El costo que viaja con el material.
                    foreach ($resultado['capas'] as $porcion) {
                        TransferenciaCapa::create([
                            'transferencia_detalle_id' => $linea->id,
                            'capa_origen_id'    => $porcion['capa_id'],
                            'cantidad'          => $porcion['cantidad'],
                            'costo_unitario'    => $porcion['costo_unitario'],
                            'lote'              => $porcion['lote'],
                            'fecha_vencimiento' => $porcion['fecha_vencimiento'],
                        ]);
                    }
                }

                $transferencia->update([
                    'estado'         => EstadoTransferencia::Despachada->value,
                    'despachada_en'  => now(),
                    'despachada_por' => $request->user()->id,
                ]);
            });
        } catch (RuntimeException $e) {
            abort(409, 'No se pudo despachar. '.$e->getMessage());
        }

        return new TransferenciaResource($transferencia->fresh()->load($this->relaciones()));
    }

    /**
     * Recibe en el destino: replica las capas que viajaron y suma el saldo.
     *
     * Puede recibirse menos de lo despachado — rotura, faltante en el camino. La
     * diferencia queda documentada en la línea y no entra al almacén; el
     * material perdido sale del sistema con el despacho, como corresponde.
     */
    public function recibir(Request $request, Transferencia $transferencia): TransferenciaResource
    {
        abort_unless($request->user()->can('transferencias.confirmar'), 403);

        abort_unless(
            $request->user()->accedeAlmacen($transferencia->almacen_destino_id),
            403,
            'Solo puede recibir quien esté asignado al almacén de destino.'
        );

        abort_unless(
            $transferencia->estado === EstadoTransferencia::Despachada,
            409,
            'Solo se recibe una transferencia en tránsito.'
        );

        $datos = $request->validate([
            'observacion'                 => ['nullable', 'string', 'max:300'],
            'detalles'                    => ['present', 'array'],
            'detalles.*.id'               => ['required', 'integer'],
            'detalles.*.cantidad_recibida'=> ['required', 'numeric', 'min:0'],
        ], [
            'detalles.*.cantidad_recibida.required' => 'Indique cuánto llegó de cada producto.',
        ]);

        $transferencia->load('detalles.capas');

        $recibidas = collect($datos['detalles'])->keyBy('id');

        DB::transaction(function () use ($transferencia, $request, $recibidas, $datos) {
            foreach ($transferencia->detalles as $linea) {
                $recibida = (float) ($recibidas[$linea->id]['cantidad_recibida'] ?? $linea->cantidad);
                $recibida = min($recibida, (float) $linea->cantidad);

                $linea->update(['cantidad_recibida' => $recibida]);

                if ($recibida <= 0) {
                    continue;
                }

                // Las capas entran en proporción a lo que llegó: si viajaron dos
                // capas y llegó la mitad, entra la mitad de cada una, no la
                // primera completa.
                $proporcion = $recibida / (float) $linea->cantidad;

                $capas = $linea->capas->map(fn ($c) => [
                    'cantidad'          => (float) $c->cantidad * $proporcion,
                    'costo_unitario'    => (float) $c->costo_unitario,
                    'lote'              => $c->lote,
                    'fecha_vencimiento' => $c->fecha_vencimiento?->toDateString(),
                ])->filter(fn ($c) => $c['cantidad'] > 0)->values()->all();

                $this->movimientos->recibirTransferencia(
                    $linea->producto_id,
                    $transferencia->almacen_destino_id,
                    $capas,
                    $transferencia,
                    $request->user()->id,
                    $linea->observacion,
                );
            }

            $transferencia->update([
                'estado'                => EstadoTransferencia::Recibida->value,
                'recibida_en'           => now(),
                'recibida_por'          => $request->user()->id,
                'observacion_recepcion' => $datos['observacion'] ?? null,
            ]);
        });

        return new TransferenciaResource($transferencia->fresh()->load($this->relaciones()));
    }

    /**
     * Anula. Si estaba en tránsito, el material vuelve al origen con sus capas
     * originales; si era un borrador, no había movido nada.
     */
    public function anular(Request $request, Transferencia $transferencia): TransferenciaResource
    {
        abort_unless($request->user()->can('transferencias.anular'), 403);

        $request->validate(['motivo' => ['required', 'string', 'max:300']]);

        abort_if(
            $transferencia->estado->esFinal(),
            409,
            'Esta transferencia ya está cerrada. Una vez recibida, el ajuste se hace con otro documento.'
        );

        $transferencia->load('detalles.capas');

        DB::transaction(function () use ($transferencia, $request) {
            if ($transferencia->estado->enTransito()) {
                foreach ($transferencia->detalles as $linea) {
                    $this->movimientos->revertirDespacho(
                        $linea->producto_id,
                        $transferencia->almacen_origen_id,
                        (float) $linea->cantidad,
                        $linea->capas,
                        $transferencia,
                        $request->user()->id,
                        $request->string('motivo')->value(),
                    );

                    $linea->capas()->delete();
                }
            }

            $transferencia->update([
                'estado'           => EstadoTransferencia::Anulada->value,
                'motivo_anulacion' => $request->string('motivo')->value(),
                'anulada_en'       => now(),
                'anulada_por'      => $request->user()->id,
            ]);
        });

        return new TransferenciaResource($transferencia->fresh()->load($this->relaciones()));
    }

    /** La guía de traslado para acompañar al material. */
    public function pdf(Request $request, Transferencia $transferencia): Response
    {
        abort_unless($request->user()->can('transferencias.ver'), 403);

        $pdf = Pdf::loadView('pdf.guia-transferencia', [
            'transferencia' => $transferencia->load($this->relaciones()),
            'institucion'   => config('app.name'),
        ])->setPaper('letter');

        return $pdf->stream(str_replace('/', '-', $transferencia->numero).'.pdf');
    }

    private function relaciones(): array
    {
        return [
            'origen:id,nombre',
            'destino:id,nombre',
            'registradoPor:id,name',
            'despachadaPor:id,name',
            'recibidaPor:id,name',
            'detalles.producto:id,codigo,nombre,unidad_medida_id',
            'detalles.producto.unidadMedida:id,codigo,permite_decimales',
        ];
    }

    private function guardarDetalles(Transferencia $transferencia, array $detalles): void
    {
        foreach ($detalles as $linea) {
            $transferencia->detalles()->create([
                'producto_id' => $linea['producto_id'],
                'cantidad'    => $linea['cantidad'],
                'observacion' => $linea['observacion'] ?? null,
            ]);
        }
    }
}
