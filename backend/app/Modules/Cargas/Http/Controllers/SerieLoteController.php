<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\ContadorSerieRequest;
use App\Modules\Cargas\Http\Requests\SerieLoteRequest;
use App\Modules\Cargas\Http\Requests\SiglaRequest;
use App\Modules\Cargas\Http\Requests\VistaPreviaSerieRequest;
use App\Modules\Cargas\Models\SerieLote;
use App\Modules\Cargas\Services\ParametroService;
use App\Modules\Cargas\Services\SerieLoteService;
use Illuminate\Http\JsonResponse;

/**
 * Series de lote y el formato de su numeración, que se define desde la
 * interfaz: marcadores de fecha, prefijo, sigla y correlativo, con reinicio
 * anual, mensual o diario.
 */
class SerieLoteController extends Controller
{
    public function __construct(
        private readonly SerieLoteService $series,
        private readonly ParametroService $parametros,
    ) {
    }

    public function index(): JsonResponse
    {
        $series = SerieLote::query()
            ->with('linea:id,codigo,nombre')
            ->orderByDesc('activa')
            ->orderBy('prefijo')
            ->get()
            ->map(fn (SerieLote $s) => $this->conEstado($s));

        return response()->json([
            'data'  => $series,
            'sigla' => $this->parametros->vigente('SIGLA_EMPRESA')?->valor,
        ]);
    }

    public function show(SerieLote $serie): JsonResponse
    {
        return response()->json(['data' => $this->conEstado($serie->load('linea:id,codigo,nombre'))]);
    }

    /** Vista previa en vivo del editor. Nunca guarda ni consume números. */
    public function vistaPrevia(VistaPreviaSerieRequest $request): JsonResponse
    {
        $serie = $request->filled('serie_id') ? SerieLote::find($request->integer('serie_id')) : null;
        $previa = $this->series->vistaPrevia($request->validated(), $serie, $request->input('fecha'));

        return response()->json(['data' => $previa]);
    }

    public function store(SerieLoteRequest $request): JsonResponse
    {
        $serie = $this->series->crear($request->validated());

        return response()->json(['data' => $this->conEstado($serie->load('linea:id,codigo,nombre'))], 201);
    }

    public function update(SerieLoteRequest $request, SerieLote $serie): JsonResponse
    {
        $serie = $this->series->actualizar($serie, $request->validated());

        return response()->json(['data' => $this->conEstado($serie->load('linea:id,codigo,nombre'))]);
    }

    /** Continuar la numeración de otro sistema: fija el último número usado en el período actual. */
    public function contador(ContadorSerieRequest $request, SerieLote $serie): JsonResponse
    {
        $proximo = $this->series->fijarUltimoNumero($serie, $request->integer('ultimo_numero'));

        return response()->json([
            'data'    => $this->conEstado($serie->refresh()->load('linea:id,codigo,nombre')),
            'mensaje' => "Listo: el próximo lote de la serie {$serie->prefijo} será {$proximo}.",
        ]);
    }

    /** Sigla de la empresa para el marcador {SIGLA}. Rige desde hoy; los lotes ya numerados no cambian. */
    public function sigla(SiglaRequest $request): JsonResponse
    {
        $parametro = $this->parametros->cambiar(
            'SIGLA_EMPRESA', $request->input('sigla'), null, 'texto', 'Sigla usada en los códigos de lote ({SIGLA})'
        );

        return response()->json(['data' => ['sigla' => $parametro->valor, 'vigente_desde' => $parametro->vigente_desde?->toDateString()]]);
    }

    private function conEstado(SerieLote $serie): array
    {
        return [
            ...$serie->toArray(),
            'lotes'          => $serie->cantidadLotes(),
            'ultimo_numero'  => $this->series->ultimoNumero($serie),
            'proximo_codigo' => $this->series->vistaPrevia($serie->only(['prefijo', 'linea_producto_id', 'origen', 'formato', 'reinicio']), $serie)['codigo'],
        ];
    }
}
