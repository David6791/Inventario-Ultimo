<?php

namespace App\Modules\Activos\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Activos\Services\ImportacionService;
use App\Modules\Activos\Services\PlantillaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ImportacionController extends Controller
{
    public function __construct(
        private readonly ImportacionService $importacion,
        private readonly PlantillaService $plantillas,
    ) {
    }

    /** Plantilla con los catálogos vigentes incrustados. */
    public function plantilla(): BinaryFileResponse
    {
        return response()
            ->download($this->plantillas->generar(), 'plantilla-activos.xlsx')
            ->deleteFileAfterSend();
    }

    /**
     * Previsualización: valida sin escribir nada.
     * Es el paso que evita descubrir los errores a mitad de una importación.
     */
    public function validar(Request $request): JsonResponse
    {
        $request->validate([
            'archivo' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:5120'],
        ]);

        try {
            $resultado = $this->importacion->validar($request->file('archivo')->getRealPath());
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }

        return response()->json($resultado);
    }

    /** Importa, y solo si no hay un solo error en el archivo. */
    public function importar(Request $request): JsonResponse
    {
        $request->validate([
            'archivo' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:5120'],
        ]);

        try {
            $resultado = $this->importacion->importar(
                $request->file('archivo')->getRealPath(),
                $request->user()->id
            );
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }

        return response()->json([
            'data' => $resultado,
            'mensaje' => "Se registraron {$resultado['creados']} activo(s).",
        ], 201);
    }
}
