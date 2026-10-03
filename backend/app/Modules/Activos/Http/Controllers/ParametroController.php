<?php

namespace App\Modules\Activos\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Activos\Http\Requests\ParametroRequest;
use App\Modules\Activos\Models\Parametro;
use App\Modules\Activos\Services\ParametroService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class ParametroController extends Controller
{
    public function __construct(private readonly ParametroService $parametros)
    {
    }

    /** Parámetros vigentes hoy, uno por clave. */
    public function index(): JsonResponse
    {
        $vigentes = Parametro::query()
            ->vigenteA()
            ->orderBy('clave')
            ->get()
            ->map(fn ($p) => [
                'id'            => $p->id,
                'clave'         => $p->clave,
                'valor'         => $p->valor,
                'tipo_dato'     => $p->tipo_dato,
                'descripcion'   => $p->descripcion,
                'vigente_desde' => $p->vigente_desde->toDateString(),
            ]);

        return response()->json(['data' => $vigentes]);
    }

    /** Historial completo de una clave. */
    public function historial(string $clave): JsonResponse
    {
        $historial = Parametro::where('clave', $clave)
            ->orderByDesc('vigente_desde')
            ->get();

        return response()->json(['data' => $historial]);
    }

    /**
     * Cambia el valor cerrando la vigencia anterior. No edita el registro
     * existente: la historia se conserva.
     */
    public function actualizar(ParametroRequest $request, string $clave): JsonResponse
    {
        try {
            $nuevo = $this->parametros->actualizar(
                $clave,
                $request->string('valor'),
                $request->date('vigente_desde'),
                $request->input('descripcion')
            );
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 422);
        }

        return response()->json([
            'data'    => $nuevo,
            'mensaje' => 'Parámetro actualizado. La vigencia anterior quedó cerrada.',
        ]);
    }

    /** Valor efectivo a una fecha, para consultas del frontend. */
    public function valorA(Request $request, string $clave): JsonResponse
    {
        try {
            $valor = $this->parametros->valor($clave, $request->query('fecha'));
        } catch (RuntimeException $e) {
            return response()->json(['mensaje' => $e->getMessage()], 404);
        }

        return response()->json(['data' => ['clave' => $clave, 'valor' => $valor]]);
    }
}
