<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permisos;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class PermisoController extends Controller
{
    /**
     * Catálogo agrupado por módulo. Alimenta el árbol de la pantalla de roles.
     * Con ~60 permisos una lista plana es inusable, por eso se agrupa acá y no
     * en el cliente.
     */
    public function index(): JsonResponse
    {
        return response()->json(['data' => Permisos::agrupado()]);
    }
}
