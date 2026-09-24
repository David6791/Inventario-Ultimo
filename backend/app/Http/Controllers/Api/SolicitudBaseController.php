<?php

namespace App\Http\Controllers\Api;

use App\Enums\EstadoSolicitud;
use App\Http\Controllers\Controller;
use App\Http\Requests\AprobarSolicitudRequest;
use App\Models\Almacen;
use App\Services\NumeradorService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Barryvdh\DomPDF\Facade\Pdf;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Lo que comparten las solicitudes de compra y de material.
 *
 * Las tablas están separadas por integridad referencial, pero el ciclo de vida
 * es el mismo: se registra un borrador, se imprime, se firma en papel, se
 * registra la aprobación con el escaneo, y después el documento se atiende con
 * un movimiento. Ese ciclo vive acá una sola vez.
 *
 * Cada subclase declara su modelo, sus permisos y qué campos propios acepta.
 */
abstract class SolicitudBaseController extends Controller
{
    public function __construct(protected NumeradorService $numerador) {}

    /** @return class-string<Model> */
    abstract protected function modelo(): string;

    /** @return class-string<JsonResource> */
    abstract protected function recurso(): string;

    /** Permiso que habilita a registrar este tipo de solicitud. */
    abstract protected function permisoRegistro(): string;

    /** Nombre del segmento de ruta, para armar la URL del documento. */
    abstract protected function rutaBase(): string;

    /** Campos propios del tipo, ya validados. */
    abstract protected function camposPropios(Request $request): array;

    /** Relaciones a cargar en la vista de detalle. */
    protected function relaciones(): array
    {
        return [
            'almacen:id,nombre',
            'registradoPor:id,name',
            'aprobadoPor:id,name',
            'detalles.producto:id,codigo,nombre,unidad_medida_id',
            'detalles.producto.unidadMedida:id,codigo',
        ];
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->can('solicitudes.ver'), 403);

        $modelo = $this->modelo();

        $solicitudes = $modelo::query()
            ->with(['almacen:id,nombre', 'registradoPor:id,name'])
            ->withCount('detalles')
            ->when($request->filled('estado'), fn ($q) => $q->where('estado', $request->string('estado')))
            ->when($request->boolean('pendientes'), fn ($q) => $q->pendientes())
            ->when($request->filled('buscar'), function ($q) use ($request) {
                $texto = '%'.$request->string('buscar').'%';
                $q->where(fn ($s) => $s->where('numero', 'ilike', $texto)
                    ->orWhere('unidad_solicitante', 'ilike', $texto)
                    ->orWhere('solicitante', 'ilike', $texto));
            })
            ->when($request->filled('desde'), fn ($q) => $q->whereDate('fecha', '>=', $request->date('desde')))
            ->when($request->filled('hasta'), fn ($q) => $q->whereDate('fecha', '<=', $request->date('hasta')))
            ->orderByDesc('fecha')
            ->orderByDesc('id')
            ->paginate($request->integer('por_pagina', 20))
            ->withQueryString();

        return $this->recurso()::collection($solicitudes);
    }

    public function show(Request $request, int|string $id): JsonResource
    {
        abort_unless($request->user()->can('solicitudes.ver'), 403);

        $solicitud = $this->modelo()::with($this->relaciones())->findOrFail((int) $id);

        return new ($this->recurso())($solicitud);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->can($this->permisoRegistro()), 403);

        $modelo = $this->modelo();
        $almacenId = (int) app('almacen_actual');

        $solicitud = DB::transaction(function () use ($request, $modelo, $almacenId) {
            $almacen = Almacen::findOrFail($almacenId);

            $solicitud = $modelo::create(array_merge([
                'numero' => $this->numerador->siguiente(
                    $almacenId, $modelo::TIPO_CONTADOR, $modelo::PREFIJO, $almacen->codigo,
                ),
                'almacen_id'         => $almacenId,
                'fecha'              => $request->date('fecha'),
                'unidad_solicitante' => $request->string('unidad_solicitante')->trim()->value(),
                'solicitante'        => $request->string('solicitante')->trim()->value(),
                'justificacion'      => $request->input('justificacion'),
                'observaciones'      => $request->input('observaciones'),
                'estado'             => EstadoSolicitud::Borrador->value,
                'registrado_por'     => $request->user()->id,
            ], $this->camposPropios($request)));

            $this->guardarDetalles($solicitud, $request->input('detalles'));

            return $solicitud;
        });

        return response()->json(
            new ($this->recurso())($solicitud->load($this->relaciones())),
            201
        );
    }

    public function update(Request $request, int|string $id): JsonResource
    {
        abort_unless($request->user()->can('solicitudes.editar'), 403);

        $solicitud = $this->modelo()::findOrFail((int) $id);

        abort_unless(
            $solicitud->estado->esEditable(),
            409,
            'Solo se puede modificar una solicitud en borrador.'
        );

        DB::transaction(function () use ($request, $solicitud) {
            $solicitud->update(array_merge([
                'fecha'              => $request->date('fecha'),
                'unidad_solicitante' => $request->string('unidad_solicitante')->trim()->value(),
                'solicitante'        => $request->string('solicitante')->trim()->value(),
                'justificacion'      => $request->input('justificacion'),
                'observaciones'      => $request->input('observaciones'),
            ], $this->camposPropios($request)));

            // En borrador nada fue atendido, así que reemplazar el detalle
            // completo es seguro.
            $solicitud->detalles()->delete();
            $this->guardarDetalles($solicitud, $request->input('detalles'));
        });

        return new ($this->recurso())($solicitud->fresh()->load($this->relaciones()));
    }

    /** Solo un borrador se elimina. Lo aprobado se anula, no se borra. */
    public function destroy(Request $request, int|string $id): JsonResponse
    {
        abort_unless($request->user()->can('solicitudes.editar'), 403);

        $solicitud = $this->modelo()::findOrFail((int) $id);

        abort_unless(
            $solicitud->estado->esEditable(),
            409,
            'Solo se puede eliminar una solicitud en borrador. Use anular en los demás casos.'
        );

        $solicitud->delete();

        return response()->json(['mensaje' => 'Borrador eliminado.']);
    }

    /**
     * Registra el resultado de la aprobación física y guarda el PDF firmado.
     * El sistema no aprueba: deja constancia de que el papel volvió firmado.
     */
    public function aprobar(AprobarSolicitudRequest $request, int|string $id): JsonResource
    {
        abort_unless($request->user()->can('solicitudes.aprobar'), 403);

        $solicitud = $this->modelo()::findOrFail((int) $id);

        abort_unless(
            $solicitud->estado === EstadoSolicitud::Borrador,
            409,
            'Esta solicitud ya fue resuelta.'
        );

        $aprobada = $request->boolean('aprobada');

        // Punto de extensión: la solicitud de material vuelve a verificar
        // existencias acá. Entre el registro y la aprobación pueden haber
        // pasado días, y aprobar un documento imposible de cumplir solo traslada
        // el problema al momento de despachar.
        if ($aprobada) {
            $this->verificarAntesDeAprobar($solicitud);
        }

        DB::transaction(function () use ($request, $solicitud, $aprobada) {
            $datos = [
                'estado' => $aprobada
                    ? EstadoSolicitud::Aprobada->value
                    : EstadoSolicitud::Rechazada->value,
                'fecha_aprobacion'       => $request->date('fecha_aprobacion'),
                'observacion_aprobacion' => $request->input('observacion'),
                'aprobado_por'           => $request->user()->id,
            ];

            if ($request->hasFile('documento')) {
                // Nombre en disco derivado del número, que es único: evita
                // colisiones y caracteres raros del archivo que subió el usuario.
                $archivo = $request->file('documento');

                $ruta = $archivo->storeAs(
                    'solicitudes/'.$solicitud->fecha->format('Y'),
                    str_replace('/', '-', $solicitud->numero).'.pdf',
                    'local'
                );

                // storeAs() devuelve false si no puede escribir y no lanza
                // excepción: sin esto la aprobación quedaba registrada sin su
                // respaldo y nadie se enteraba.
                abort_if(
                    $ruta === false,
                    500,
                    'No se pudo guardar el archivo en el servidor. Revise los permisos de la carpeta storage.'
                );

                $datos['documento_ruta']   = $ruta;
                $datos['documento_nombre'] = $archivo->getClientOriginalName();
            }

            $solicitud->update($datos);
        });

        return new ($this->recurso())($solicitud->fresh()->load($this->relaciones()));
    }

    public function anular(Request $request, int|string $id): JsonResource
    {
        abort_unless($request->user()->can('solicitudes.anular'), 403);

        $request->validate(['motivo' => ['required', 'string', 'max:300']]);

        $solicitud = $this->modelo()::findOrFail((int) $id);

        abort_if($solicitud->estado->esFinal(), 409, 'Esta solicitud ya está cerrada.');

        // Si ya generó movimientos, anularla dejaría el kardex sin respaldo.
        abort_if(
            $solicitud->tieneMovimientos(),
            409,
            'No se puede anular: ya tiene movimientos registrados. Anule primero los documentos que la atendieron.'
        );

        $solicitud->update([
            'estado'        => EstadoSolicitud::Anulada->value,
            'observaciones' => trim(($solicitud->observaciones ?? '')
                ."\nAnulada: ".$request->string('motivo')),
        ]);

        return new ($this->recurso())($solicitud->fresh()->load($this->relaciones()));
    }

    /**
     * Sirve el PDF firmado. No se guarda en disco público: el respaldo de una
     * solicitud no debe quedar accesible con solo adivinar la URL.
     */
    public function documento(Request $request, int|string $id): StreamedResponse
    {
        abort_unless($request->user()->can('solicitudes.ver'), 403);

        $solicitud = $this->modelo()::findOrFail((int) $id);

        abort_unless($solicitud->documento_ruta, 404, 'Esta solicitud no tiene documento adjunto.');

        return Storage::disk('local')->download(
            $solicitud->documento_ruta,
            $solicitud->documento_nombre ?? "{$solicitud->numero}.pdf"
        );
    }

    /** Cada tipo decide qué comprobar antes de dar por aprobada la solicitud. */
    protected function verificarAntesDeAprobar(Model $solicitud): void
    {
        // Por defecto no hay nada que verificar.
    }

    /**
     * Genera el PDF para imprimir, firmar y escanear.
     *
     * Se sirve como descarga y no se guarda: es un documento derivado que se
     * puede volver a generar en cualquier momento. Lo que sí se archiva es el
     * escaneo firmado, que es el que tiene valor probatorio.
     */
    public function pdf(Request $request, int|string $id): \Illuminate\Http\Response
    {
        abort_unless($request->user()->can('solicitudes.ver'), 403);

        $solicitud = $this->modelo()::with($this->relaciones())->findOrFail((int) $id);

        $pdf = Pdf::loadView($this->vistaPdf(), [
            'solicitud'  => $solicitud,
            'institucion' => config('app.name'),
        ])->setPaper('letter');

        return $pdf->stream(str_replace('/', '-', $solicitud->numero).'.pdf');
    }

    /** Plantilla Blade del PDF. Cada tipo tiene la suya. */
    abstract protected function vistaPdf(): string;

    protected function guardarDetalles(Model $solicitud, array $detalles): void
    {
        foreach ($detalles as $linea) {
            $solicitud->detalles()->create([
                'producto_id'    => $linea['producto_id'],
                'cantidad'       => $linea['cantidad'],
                'especificacion' => $linea['especificacion'] ?? null,
            ]);
        }
    }
}
