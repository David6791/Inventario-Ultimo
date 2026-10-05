<?php

namespace App\Modules\Activos\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Personas a las que se puede asignar un bien.
 *
 * POR QUÉ EXISTE ESTE CONTROLADOR
 *
 * Antes el frontend consultaba /api/usuarios, que exige el permiso
 * `usuarios.ver`. Ese permiso abre la administración completa de usuarios:
 * correos, cargos, roles, estado de la cuenta. Un encargado de activos no
 * necesita nada de eso para elegir a quién entregarle una laptop.
 *
 * Este endpoint devuelve lo mínimo —id, nombre y cargo— y exige solo
 * `activos.ver`. Es la diferencia entre dar acceso a un dato y dar acceso
 * a un módulo.
 */
class CustodioController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $personas = User::query()
            ->where('activo', true)
            ->when($request->filled('buscar'), function ($q) use ($request) {
                $texto = '%' . $request->string('buscar') . '%';
                $q->where(fn ($s) => $s->where('name', 'ilike', $texto)
                                       ->orWhere('ci', 'ilike', $texto));
            })
            ->orderBy('name')
            ->get(['id', 'name', 'ci', 'cargo'])
            ->map(fn ($u) => [
                'id'     => $u->id,
                'nombre' => $u->name,
                'ci'     => $u->ci,
                'cargo'  => $u->cargo,
            ]);

        return response()->json(['data' => $personas]);
    }

    /**
     * Resumen de lo que una persona tiene a cargo.
     * Se usa en el selector para avisar antes de asignar más bienes.
     */
    public function resumen(int $custodio): JsonResponse
    {
        $bienes = \App\Modules\Activos\Models\Activo::query()
            ->where('custodio_id', $custodio)
            ->vigentes()
            ->get(['id', 'valor_origen']);

        return response()->json([
            'data' => [
                'cantidad' => $bienes->count(),
                'valor'    => round($bienes->sum('valor_origen'), 2),
            ],
        ]);
    }
}
