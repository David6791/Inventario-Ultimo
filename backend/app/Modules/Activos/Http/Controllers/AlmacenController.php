<?php

namespace App\Modules\Activos\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Almacenes disponibles para asignar a un centro de costo.
 *
 * Devuelve lo mínimo y exige un permiso del módulo de activos, en vez de
 * obligar a tener `almacenes.ver`, que abre la administración completa.
 */
class AlmacenController extends Controller
{
    public function index(): JsonResponse
    {
        $almacenes = DB::table('almacenes')
            ->where('activo', true)
            ->orderBy('nombre')
            ->get(['id', 'codigo', 'nombre']);

        return response()->json(['data' => $almacenes]);
    }
}