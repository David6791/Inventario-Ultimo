<?php

namespace App\Modules\Comun\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Comun\Http\Requests\EmpresaRequest;
use App\Modules\Comun\Services\EmpresaService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Datos de la empresa. El nombre y el logo son públicos (los muestra la
 * pantalla de ingreso); cambiarlos exige empresa.configurar.
 */
class EmpresaController extends Controller
{
    public function __construct(private readonly EmpresaService $empresa)
    {
    }

    public function publico(): JsonResponse
    {
        return response()->json(['data' => $this->empresa->publico()]);
    }

    public function logo(): Response
    {
        return $this->imagen('logo');
    }

    public function marcaAgua(): Response
    {
        return $this->imagen('marca');
    }

    public function actualizar(EmpresaRequest $request): JsonResponse
    {
        $datos = $this->empresa->actualizar(
            $request->user(),
            $request->only(['nombre', 'subtitulo', 'marca_agua_opacidad']),
            $request->file('logo'),
            $request->file('marca_agua'),
            $request->boolean('quitar_logo'),
            $request->boolean('quitar_marca_agua'),
        );

        return response()->json(['data' => $datos, 'mensaje' => 'Datos de la empresa guardados. Los documentos nuevos ya salen así.']);
    }

    private function imagen(string $cual): Response
    {
        $ruta = $this->empresa->ruta($cual);
        abort_if($ruta === null, 404, 'No hay imagen cargada.');

        // La URL lleva ?v=<versión>: se puede guardar en caché sin miedo a mostrar una vieja.
        return response()->file($ruta, ['Cache-Control' => 'public, max-age=86400']);
    }
}
