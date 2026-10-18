<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\AnularAnalisisRequest;
use App\Modules\Cargas\Http\Requests\CertificadoRequest;
use App\Modules\Cargas\Http\Requests\FijarLeyRequest;
use App\Modules\Cargas\Http\Requests\LecturaEstimadaRequest;
use App\Modules\Cargas\Http\Requests\ReabrirLoteRequest;
use App\Modules\Cargas\Http\Requests\RegistrarAnalisisRequest;
use App\Modules\Cargas\Http\Requests\RegistrarMuestraRequest;
use App\Modules\Cargas\Models\Analisis;
use App\Modules\Cargas\Models\Laboratorio;
use App\Modules\Cargas\Models\Lote;
use App\Modules\Cargas\Models\Muestra;
use App\Modules\Cargas\Services\AnalisisService;
use App\Modules\Cargas\Services\ParametroService;
use App\Modules\Cargas\Support\UrlVerificacion;
use App\Modules\Comun\Support\CodigoBarras;
use App\Modules\Comun\Support\CodigoQr;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/** Laboratorio del lote: muestras, análisis, comparación, ley final, cierre y reapertura. */
class AnalisisController extends Controller
{
    public function __construct(private readonly AnalisisService $servicio)
    {
    }

    /** Bandeja: lotes por muestrear (RECIBIDO) y en análisis (MUESTREADO) de las sedes del usuario. */
    public function bandeja(Request $request): JsonResponse
    {
        $u = $request->user();
        $filas = DB::table('cargas.v_lote_laboratorio as v')
            ->join('cargas.lote as l', 'l.id', '=', 'v.lote_id')
            ->leftJoin('cargas.productor as p', 'p.id', '=', 'l.productor_id')
            ->leftJoin('cargas.linea_producto as lp', 'lp.id', '=', 'l.linea_producto_id')
            ->when(! $u->can('cargas.ver-todos-almacenes'), fn ($q) => $q->whereIn('v.almacen_id', $u->almacenesIds()))
            ->when($request->filled('estado'), fn ($q) => $q->where('v.estado', $request->query('estado')))
            ->orderBy('v.fecha_recepcion')
            ->limit(500)
            ->get(['v.*', 'p.nombre as productor', 'lp.nombre as linea', 'l.material']);

        return response()->json(['data' => $filas]);
    }

    /** Todo lo de laboratorio de un lote, para su ficha. */
    public function show(Request $request, Lote $lote): JsonResponse
    {
        $this->ambito($request, $lote);

        $muestras = $lote->muestras()->with([
            'porciones', 'registradoPor:id,name',
            'analisis.laboratorio:id,nombre', 'analisis.registradoPor:id,name',
            'analisis.resultados.elemento:id,codigo,unidad_ley',
        ])->get();

        $resumen = DB::table('cargas.v_lote_resumen')->where('lote_id', $lote->id)
            ->first(['humedad_pct', 'peso_neto_humedo_kg', 'peso_neto_seco_kg']);

        return response()->json(['data' => [
            'estado'      => $lote->estado,
            'elementos'   => $this->servicio->elementosDe($lote),
            'muestras'    => $muestras,
            'ensayes'     => DB::table('cargas.v_lote_ensayes')->where('lote_id', $lote->id)->get(),
            'leyes'       => $lote->leyes()->with(['elemento:id,codigo,nombre,unidad_ley', 'determinadoPor:id,name'])->get(),
            'historial'   => DB::table('cargas.lote_ley_historial as h')
                ->join('cargas.elemento as e', 'e.id', '=', 'h.elemento_id')
                ->leftJoin('users as u', 'u.id', '=', 'h.cambiado_por')
                ->where('h.lote_id', $lote->id)->orderByDesc('h.id')
                ->get(['h.*', 'e.codigo as elemento', 'u.name as cambiado_por_nombre']),
            'lecturas'    => $lote->lecturasEstimadas()->with('elemento:id,codigo,unidad_ley')->get(),
            'laboratorios'=> Laboratorio::where('activo', true)->orderByDesc('propio')->orderBy('nombre')->get(['id', 'nombre', 'propio']),
            'criterio_sugerido' => app(ParametroService::class)->vigente('CRITERIO_LEY_DENTRO_LIMITE')?->valor ?? 'PROMEDIO',
            'humedad_pct'       => $resumen->humedad_pct ?? null,
            'peso_neto_seco_kg' => $resumen->peso_neto_seco_kg ?? null,
        ]]);
    }

    public function registrarMuestra(RegistrarMuestraRequest $request, Lote $lote): JsonResponse
    {
        $this->ambito($request, $lote);
        $muestra = $this->servicio->registrarMuestra($lote, $request->validated(), $request->user());

        return response()->json([
            'data'    => $muestra,
            'mensaje' => $muestra->tipo === 'REMUESTREO'
                ? "Remuestreo {$muestra->codigo} registrado: las leyes anteriores dejaron de valer."
                : "Muestra {$muestra->codigo} registrada. El lote pasó a MUESTREADO.",
        ], 201);
    }

    /** Etiquetas de las tres porciones (empresa, productor, testigo) en una hoja carta, para recortar. */
    public function etiquetas(Request $request, Muestra $muestra): Response
    {
        $lote = $muestra->lote()->with(['productor:id,nombre', 'linea:id,nombre', 'almacen:id,nombre'])->first();
        $this->ambito($request, $lote);

        $porciones = $muestra->porciones()->get()->map(fn ($p) => [
            'porcion' => $p,
            'barras'  => CodigoBarras::dataUri($muestra->codigo . '-' . substr($p->destino, 0, 1), 1.2, 40),
        ]);

        return Pdf::loadView('pdf.cargas.etiquetas-muestra', [
            'muestra'     => $muestra,
            'lote'        => $lote,
            'porciones'   => $porciones,
            'qr'          => CodigoQr::dataUri(UrlVerificacion::de($lote)),
            'institucion' => config('app.empresa'),
        ])->setPaper('letter')->stream("etiquetas-{$muestra->codigo}.pdf");
    }

    public function registrarAnalisis(RegistrarAnalisisRequest $request, Muestra $muestra): JsonResponse
    {
        $this->ambito($request, $muestra->lote);
        $a = $this->servicio->registrarAnalisis($muestra, $request->datos(), $request->file('certificado'), $request->user());

        return response()->json([
            'data'    => $a,
            'mensaje' => 'Análisis ' . strtolower($a->tipo === 'PRODUCTOR' ? 'del productor' : ($a->tipo === 'EMPRESA' ? 'de la empresa' : 'dirimente'))
                . " registrado (certificado {$a->numero_certificado}).",
        ], 201);
    }

    public function adjuntarCertificado(CertificadoRequest $request, Analisis $analisis): JsonResponse
    {
        $this->ambito($request, $analisis->muestra->lote);
        $a = $this->servicio->adjuntarCertificado($analisis, $request->file('archivo'), $request->user());

        return response()->json(['data' => $a, 'mensaje' => 'Certificado adjuntado.']);
    }

    public function certificado(Request $request, Analisis $analisis): Response
    {
        $this->ambito($request, $analisis->muestra->lote);
        $ruta = $analisis->archivo_path;
        abort_unless($ruta && Storage::disk(AnalisisService::DISCO)->exists($ruta), 404, 'Este análisis no tiene certificado adjunto.');

        return Storage::disk(AnalisisService::DISCO)->response($ruta, basename($ruta), [], 'inline');
    }

    public function anularAnalisis(AnularAnalisisRequest $request, Analisis $analisis): JsonResponse
    {
        $this->ambito($request, $analisis->muestra->lote);
        $a = $this->servicio->anularAnalisis($analisis, $request->input('motivo'), $request->user());

        return response()->json(['data' => $a, 'mensaje' => 'Análisis anulado. Las leyes que dependían de él se quitaron.']);
    }

    public function fijarLey(FijarLeyRequest $request, Lote $lote, int $elemento): JsonResponse
    {
        $this->ambito($request, $lote);
        $ley = $this->servicio->fijarLey($lote, $elemento, $request->input('criterio'),
            $request->filled('valor') ? (float) $request->input('valor') : null, $request->input('observacion'), $request->user());

        $valor = rtrim(rtrim(number_format((float) $ley->valor, 4, ',', '.'), '0'), ',');

        return response()->json(['data' => $ley, 'mensaje' => "Ley final de {$ley->elemento->codigo}: {$valor} "
            . $ley->elemento->unidad_ley . ' (' . strtolower($ley->criterio) . ').']);
    }

    public function quitarLey(Request $request, Lote $lote, int $elemento): JsonResponse
    {
        abort_unless($request->user()->can('cargas.fijar-ley'), 403);
        $this->ambito($request, $lote);
        $this->servicio->quitarLey($lote, $elemento, $request->user());

        return response()->json(['mensaje' => 'Ley quitada.']);
    }

    public function cerrar(Request $request, Lote $lote): JsonResponse
    {
        abort_unless($request->user()->can('cargas.fijar-ley'), 403, 'No tiene permiso para fijar la ley final.');
        $this->ambito($request, $lote);
        $lote = $this->servicio->cerrarAnalisis($lote, $request->user());

        return response()->json(['data' => $lote, 'mensaje' => "Lote {$lote->codigo} ANALIZADO."]);
    }

    public function reabrir(ReabrirLoteRequest $request, Lote $lote): JsonResponse
    {
        $this->ambito($request, $lote);
        $lote = $this->servicio->reabrir($lote, $request->input('motivo'), $request->user());

        return response()->json(['data' => $lote,
            'mensaje' => "Lote {$lote->codigo} reabierto: puede corregir leyes o registrar un remuestreo."]);
    }

    public function lecturaEstimada(LecturaEstimadaRequest $request, Lote $lote): JsonResponse
    {
        $this->ambito($request, $lote);
        $this->servicio->lecturaEstimada($lote, $request->input('lecturas'), $request->input('metodo'), $request->user());

        return response()->json(['mensaje' => 'Lectura estimada guardada. Es referencial: no se usa para pagar.']);
    }

    private function ambito(Request $request, Lote $lote): void
    {
        abort_unless($lote->esDelAmbitoDe($request->user()), 403, 'El lote es de una sede a la que su usuario no tiene acceso.');
    }
}
