<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\PlantillaBasculaRequest;
use App\Modules\Cargas\Http\Requests\ProbarPlantillaRequest;
use App\Modules\Cargas\Models\PlantillaBascula;
use App\Modules\Cargas\Services\FotoRecepcionService;
use App\Modules\Cargas\Services\OcrTicketService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/** Plantillas de báscula: dónde está cada dato en el ticket de cada balanza. */
class PlantillaBasculaController extends Controller
{
    public function __construct(private readonly FotoRecepcionService $fotos, private readonly OcrTicketService $ocr)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $q = PlantillaBascula::query()->orderBy('nombre');
        if ($request->boolean('solo_activas')) {
            $q->where('activa', true);
        }

        return response()->json([
            'data'   => $q->get(),
            'campos' => collect(PlantillaBascula::CAMPOS)->map(fn ($c, $k) => ['campo' => $k, ...$c])->values(),
            'ocr'    => $this->ocr->disponible(),
        ]);
    }

    public function store(PlantillaBasculaRequest $request): JsonResponse
    {
        $p = new PlantillaBascula([...$request->datos(), 'registrado_por' => $request->user()->id]);
        $this->guardarMuestra($request, $p);
        $p->save();

        return response()->json(['data' => $p->refresh(), 'mensaje' => "Plantilla {$p->nombre} creada."], 201);
    }

    public function update(PlantillaBasculaRequest $request, PlantillaBascula $plantilla): JsonResponse
    {
        $plantilla->fill($request->datos());
        $this->guardarMuestra($request, $plantilla);
        $plantilla->save();

        return response()->json(['data' => $plantilla->refresh(), 'mensaje' => "Plantilla {$plantilla->nombre} guardada."]);
    }

    public function muestra(PlantillaBascula $plantilla): BinaryFileResponse
    {
        abort_unless($plantilla->imagen_muestra && Storage::disk(FotoRecepcionService::DISCO)->exists($plantilla->imagen_muestra), 404,
            'La plantilla no tiene foto de muestra.');

        return response()->file(Storage::disk(FotoRecepcionService::DISCO)->path($plantilla->imagen_muestra),
            ['Cache-Control' => 'private, max-age=300']);
    }

    /** Lee una foto con los recuadros que se están dibujando, sin guardar nada. */
    public function probar(ProbarPlantillaRequest $request): JsonResponse
    {
        $datos = $request->datos();

        return response()->json(['data' => $this->fotos->leer($request->file('imagen')->getRealPath(), $datos['campos'])]);
    }

    private function guardarMuestra(PlantillaBasculaRequest $request, PlantillaBascula $p): void
    {
        if (! $request->hasFile('muestra')) {
            return;
        }
        $anterior = $p->imagen_muestra;
        $p->imagen_muestra = $request->file('muestra')->store('cargas/plantillas', FotoRecepcionService::DISCO);
        if ($anterior) {
            Storage::disk(FotoRecepcionService::DISCO)->delete($anterior);
        }
    }
}
