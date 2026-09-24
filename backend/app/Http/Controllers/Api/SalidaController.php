<?php

namespace App\Http\Controllers\Api;

use App\Enums\EstadoDocumento;
use App\Http\Controllers\Controller;
use App\Http\Requests\SalidaRequest;
use App\Http\Resources\SalidaResource;
use App\Models\Almacen;
use App\Models\Salida;
use App\Models\Solicitante;
use App\Models\UnidadSolicitante;
use App\Services\MovimientoService;
use App\Services\NumeradorService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Notas de salida.
 *
 * Circuito: se registra el borrador, se imprime la nota, quien retira la firma,
 * se confirma (ahí se descuenta el stock y se escribe el kardex) y después se
 * sube el escaneo firmado.
 *
 * El stock se descuenta al confirmar y no al subir el PDF porque el material
 * sale del almacén cuando se entrega en el mostrador; el escaneo llega más
 * tarde. Esperar al PDF dejaría el sistema mostrando existencias que ya no
 * están.
 */
class SalidaController extends Controller
{
    public function __construct(
        private NumeradorService $numerador,
        private MovimientoService $movimientos,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('salidas.ver'), 403);

        $salidas = Salida::query()
            ->with(['almacen:id,nombre', 'registradoPor:id,name'])
            ->withCount('detalles')
            ->when($request->filled('estado'), fn ($q) => $q->where('estado', $request->string('estado')))
            ->when($request->boolean('sin_respaldo'), fn ($q) => $q->sinRespaldo())
            ->when($request->filled('buscar'), function ($q) use ($request) {
                $texto = '%'.$request->string('buscar').'%';
                $q->where(fn ($s) => $s->where('numero', 'ilike', $texto)
                    ->orWhere('unidad_solicitante', 'ilike', $texto)
                    ->orWhere('solicitante', 'ilike', $texto)
                    ->orWhere('recibido_por', 'ilike', $texto));
            })
            ->when($request->filled('desde'), fn ($q) => $q->whereDate('fecha', '>=', $request->date('desde')))
            ->when($request->filled('hasta'), fn ($q) => $q->whereDate('fecha', '<=', $request->date('hasta')))
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->paginate($request->integer('por_pagina', 20))
            ->withQueryString();

        return SalidaResource::collection($salidas);
    }

    public function show(Request $request, Salida $salida): SalidaResource
    {
        abort_unless($request->user()->can('salidas.ver'), 403);

        return new SalidaResource($salida->load($this->relaciones()));
    }

    public function store(SalidaRequest $request): JsonResponse
    {
        abort_unless($request->user()->can('salidas.registrar'), 403);

        $almacenId = (int) app('almacen_actual');

        $salida = DB::transaction(function () use ($request, $almacenId) {
            $almacen = Almacen::findOrFail($almacenId);

            $salida = Salida::create([
                'numero' => $this->numerador->siguiente(
                    $almacenId, Salida::TIPO_CONTADOR, Salida::PREFIJO, $almacen->codigo,
                ),
                'almacen_id'     => $almacenId,
                'fecha'          => $request->date('fecha'),
                'destino'        => $request->input('destino'),
                'motivo'         => $request->input('motivo'),
                'estado'         => EstadoDocumento::Borrador->value,
                'registrado_por' => $request->user()->id,
                ...$this->datosSolicitante($request),
            ]);

            $this->guardarDetalles($salida, $request->input('detalles'));

            return $salida;
        });

        return response()->json(new SalidaResource($salida->load($this->relaciones())), 201);
    }

    public function update(SalidaRequest $request, Salida $salida): SalidaResource
    {
        abort_unless($request->user()->can('salidas.editar'), 403);

        abort_unless(
            $salida->estado->esEditable(),
            409,
            'Solo se puede modificar una salida en borrador. Una vez confirmada ya movió existencias.'
        );

        DB::transaction(function () use ($request, $salida) {
            $salida->update([
                'fecha'   => $request->date('fecha'),
                'destino' => $request->input('destino'),
                'motivo'  => $request->input('motivo'),
                ...$this->datosSolicitante($request),
            ]);

            $salida->detalles()->delete();
            $this->guardarDetalles($salida, $request->input('detalles'));
        });

        return new SalidaResource($salida->fresh()->load($this->relaciones()));
    }

    public function destroy(Request $request, Salida $salida): JsonResponse
    {
        abort_unless($request->user()->can('salidas.editar'), 403);

        abort_unless(
            $salida->estado->esEditable(),
            409,
            'Solo se puede eliminar un borrador. Una salida confirmada se anula.'
        );

        $salida->delete();

        return response()->json(['mensaje' => 'Borrador eliminado.']);
    }

    /**
     * Confirma la entrega: descuenta existencias y escribe el kardex.
     *
     * Este es el momento en que el material sale del almacén. Quien confirma no
     * debería ser quien registró — control interno básico, y por eso son
     * permisos distintos.
     */
    public function confirmar(Request $request, Salida $salida): SalidaResource
    {
        abort_unless($request->user()->can('salidas.confirmar'), 403);

        abort_unless(
            $salida->estado === EstadoDocumento::Borrador,
            409,
            'Esta salida ya fue confirmada o anulada.'
        );

        $salida->load('detalles.producto:id,nombre');

        abort_if($salida->detalles->isEmpty(), 409, 'La salida no tiene detalle.');

        try {
            DB::transaction(function () use ($salida, $request) {
                foreach ($salida->detalles as $linea) {
                    // El costo sale de las capas que efectivamente se
                    // consumieron, no de un promedio del almacén. Con PEPS, dos
                    // salidas del mismo producto pueden valer distinto.
                    $resultado = $this->movimientos->registrarSalida(
                        $linea->producto_id,
                        $salida->almacen_id,
                        (float) $linea->cantidad,
                        $salida,
                        Salida::TIPO_DOCUMENTO,
                        $request->user()->id,
                        $linea->id,
                        $linea->observacion,
                    );

                    $linea->update(['costo_unitario' => $resultado['costo_unitario']]);
                }

                $salida->update([
                    'estado'         => EstadoDocumento::Confirmada->value,
                    'confirmada_en'  => now(),
                    'confirmada_por' => $request->user()->id,
                ]);
            });
        } catch (\RuntimeException $e) {
            // El saldo pudo cambiar entre que se armó el borrador y este momento.
            abort(409, 'No se pudo confirmar. '.$e->getMessage());
        }

        return new SalidaResource($salida->fresh()->load($this->relaciones()));
    }

    /**
     * Anula una salida confirmada y devuelve las existencias.
     *
     * No borra el movimiento original: escribe uno inverso en el kardex, así la
     * historia queda completa y se ve que hubo una anulación.
     */
    public function anular(Request $request, Salida $salida): SalidaResource
    {
        abort_unless($request->user()->can('salidas.anular'), 403);

        $request->validate(['motivo' => ['required', 'string', 'max:300']]);

        abort_unless(
            $salida->estado === EstadoDocumento::Confirmada,
            409,
            'Solo se anula una salida confirmada. Un borrador se elimina.'
        );

        $salida->load('detalles');

        DB::transaction(function () use ($salida, $request) {
            foreach ($salida->detalles as $linea) {
                // Repone cada capa por su monto exacto: no basta con sumar la
                // cantidad, hay que devolverla a las capas de las que salió.
                $this->movimientos->revertirSalida(
                    $linea->id,
                    $linea->producto_id,
                    $salida->almacen_id,
                    (float) $linea->cantidad,
                    $salida,
                    Salida::TIPO_DOCUMENTO,
                    $request->user()->id,
                    $request->string('motivo')->value(),
                );
            }

            $salida->update([
                'estado'           => EstadoDocumento::Anulada->value,
                'motivo_anulacion' => $request->string('motivo')->value(),
                'anulada_en'       => now(),
                'anulada_por'      => $request->user()->id,
            ]);
        });

        return new SalidaResource($salida->fresh()->load($this->relaciones()));
    }

    /** Sube el escaneo firmado. Llega después de confirmar. */
    public function subirRespaldo(Request $request, Salida $salida): SalidaResource
    {
        abort_unless($request->user()->can('salidas.confirmar'), 403);

        $request->validate([
            'respaldo' => ['required', 'file', 'mimes:pdf', 'max:10240'],
        ], [
            'respaldo.required' => 'Adjunte la nota firmada en PDF.',
            'respaldo.mimes'    => 'El respaldo debe ser un archivo PDF.',
            'respaldo.max'      => 'El respaldo no puede superar los 10 MB.',
        ]);

        abort_unless(
            $salida->estado === EstadoDocumento::Confirmada,
            409,
            'Solo se adjunta respaldo a una salida confirmada.'
        );

        $archivo = $request->file('respaldo');

        $ruta = $archivo->storeAs(
            'salidas/'.$salida->fecha->format('Y'),
            str_replace('/', '-', $salida->numero).'.pdf',
            'local'
        );

        /*
        | storeAs() devuelve false cuando no puede escribir — típicamente por
        | permisos de la carpeta storage — y no lanza excepción. Sin esta
        | comprobación la API respondía 200 y el usuario creía que el respaldo
        | quedó guardado, cuando la columna se llenaba con una cadena vacía.
        */
        abort_if(
            $ruta === false,
            500,
            'No se pudo guardar el archivo en el servidor. Revise los permisos de la carpeta storage.'
        );

        $salida->update([
            'respaldo_ruta'      => $ruta,
            'respaldo_nombre'    => $archivo->getClientOriginalName(),
            'respaldo_subido_en' => now(),
        ]);

        return new SalidaResource($salida->fresh()->load($this->relaciones()));
    }

    public function respaldo(Request $request, Salida $salida): StreamedResponse
    {
        abort_unless($request->user()->can('salidas.ver'), 403);
        abort_unless($salida->respaldo_ruta, 404, 'Esta salida no tiene respaldo adjunto.');

        return Storage::disk('local')->download(
            $salida->respaldo_ruta,
            $salida->respaldo_nombre ?? "{$salida->numero}.pdf"
        );
    }

    /** La nota para imprimir y hacer firmar. */
    public function pdf(Request $request, Salida $salida): Response
    {
        abort_unless($request->user()->can('salidas.ver'), 403);

        $pdf = Pdf::loadView('pdf.nota-salida', [
            'salida'      => $salida->load($this->relaciones()),
            'institucion' => config('app.name'),
        ])->setPaper('letter');

        return $pdf->stream(str_replace('/', '-', $salida->numero).'.pdf');
    }

    /**
     * Resuelve los identificadores del catálogo y congela el texto.
     *
     * El documento guarda las dos cosas: el identificador para agrupar en
     * reportes, y el nombre tal como estaba al firmarse. Si mañana renombran la
     * unidad o la persona cambia de área, la nota tiene que seguir diciendo lo
     * que decía.
     */
    private function datosSolicitante(Request $request): array
    {
        $unidad      = UnidadSolicitante::findOrFail($request->integer('unidad_solicitante_id'));
        $solicitante = Solicitante::findOrFail($request->integer('solicitante_id'));
        $recibe      = Solicitante::findOrFail($request->integer('recibido_por_id'));

        return [
            'unidad_solicitante_id' => $unidad->id,
            'solicitante_id'        => $solicitante->id,
            'recibido_por_id'       => $recibe->id,

            'unidad_solicitante' => $unidad->nombre,
            'solicitante'        => $solicitante->nombre,
            'recibido_por'       => $recibe->nombre,

            // Si no se indica uno propio, se toma el de la unidad.
            'centro_costo' => $request->input('centro_costo') ?: $unidad->centro_costo,
        ];
    }

    private function relaciones(): array
    {
        return [
            'almacen:id,nombre',
            'registradoPor:id,name',
            'confirmadaPor:id,name',
            'detalles.producto:id,codigo,nombre,unidad_medida_id',
            'detalles.producto.unidadMedida:id,codigo',
        ];
    }

    private function guardarDetalles(Salida $salida, array $detalles): void
    {
        foreach ($detalles as $linea) {
            $salida->detalles()->create([
                'producto_id' => $linea['producto_id'],
                'cantidad'    => $linea['cantidad'],
                'observacion' => $linea['observacion'] ?? null,
            ]);
        }
    }
}
