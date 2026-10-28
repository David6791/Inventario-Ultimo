<?php

namespace App\Modules\Cargas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Cargas\Http\Requests\SubirFotoRequest;
use App\Modules\Cargas\Models\PlantillaBascula;
use App\Modules\Cargas\Models\RecepcionFoto;
use App\Modules\Cargas\Services\FotoRecepcionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Fotos de la recepción. Se suben antes de registrar el pesaje: la respuesta
 * trae lo que se leyó del ticket para llenar el formulario, y el id de la foto
 * para ligarla al pesaje al guardar.
 */
class FotoRecepcionController extends Controller
{
    public function __construct(private readonly FotoRecepcionService $fotos)
    {
    }

    public function store(SubirFotoRequest $request): JsonResponse
    {
        $plantilla = $request->filled('plantilla_id') ? PlantillaBascula::find($request->integer('plantilla_id')) : null;
        $foto = $this->fotos->subir($request->file('imagen'), $request->file('original'), $request->input('tipo'),
            $plantilla, $request->user(), $request->input('lector') ?: 'tesseract');

        // La báscula: la de la plantilla elegida o, con Claude, la que dice la boleta.
        $bascula = $plantilla?->bascula ?? ($foto->lectura['bascula'] ?? null);

        return response()->json(['data' => [...$foto->toArray(), 'bascula' => $bascula]], 201);
    }

    public function imagen(Request $request, RecepcionFoto $foto): BinaryFileResponse
    {
        $lote = $foto->pesaje?->lote ?? $foto->pesajeSaco?->pesaje?->lote;
        if ($lote) {
            abort_unless($lote->esDelAmbitoDe($request->user()), 403, 'El lote es de una sede a la que su usuario no tiene acceso.');
        } else {
            abort_unless($foto->subida_por === $request->user()->id, 403, 'Esa foto todavía no es parte de ningún lote.');
        }
        $ruta = $this->fotos->rutaAbsoluta($foto, $request->boolean('original'));
        abort_unless($ruta !== null, 404, 'No se encontró el archivo de la foto.');

        return response()->file($ruta, ['Cache-Control' => 'private, max-age=3600']);
    }
}
