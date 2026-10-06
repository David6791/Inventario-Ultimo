<?php

namespace App\Modules\Activos\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Activos\Models\Activo;
use App\Modules\Activos\Models\Empleado;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Personas a las que se puede asignar un bien.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * SON EMPLEADOS, NO USUARIOS
 *
 * Antes este endpoint listaba cuentas del sistema. Eso dejaba fuera a la
 * mayor parte del personal: un operario de acopio recibe herramientas y
 * responde por ellas sin tener login.
 *
 * El custodio es un empleado. Quienes además acceden al sistema tienen su
 * `user_id`, pero eso no cambia quién puede recibir bienes.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * EL LISTADO RESPETA EL ÁMBITO
 *
 * Solo aparecen empleados de los centros que el usuario alcanza. Asignar un
 * bien a alguien de otro centro sería asignarlo fuera de la responsabilidad
 * de quien lo entrega.
 */
class CustodioController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $centros = $this->centrosDelUsuario($request->user());

        $empleados = Empleado::query()
            ->activos()
            ->with('centro:id,codigo,nombre')
            ->when($centros !== null, fn ($q) => $q->whereIn('centro_costo_id', $centros))
            ->when($request->filled('centro_costo_id'),
                fn ($q) => $q->where('centro_costo_id', $request->integer('centro_costo_id')))
            ->when($request->filled('buscar'), function ($q) use ($request) {
                $t = '%' . $request->string('buscar') . '%';
                $q->where(fn ($s) => $s
                    ->where('nombres', 'ilike', $t)
                    ->orWhere('apellido_paterno', 'ilike', $t)
                    ->orWhere('ci', 'ilike', $t)
                    ->orWhere('codigo', 'ilike', $t));
            })
            ->orderBy('apellido_paterno')->orderBy('nombres')
            ->get()
            ->map(fn ($e) => [
                'id'              => $e->id,
                'codigo'          => $e->codigo,
                'nombre'          => $e->nombre_completo,
                'etiqueta'        => $e->etiqueta,
                'ci'              => $e->ci,
                'cargo'           => $e->cargo,
                'centro_costo_id' => $e->centro_costo_id,
                'centro'          => $e->centro?->codigo,
                'tiene_acceso'    => $e->tieneAcceso(),
            ]);

        return response()->json(['data' => $empleados]);
    }

    /**
     * Qué tiene a cargo una persona.
     * Se consulta antes de asignarle más, y es la base del descargo.
     */
    public function resumen(Empleado $empleado): JsonResponse
    {
        $bienes = Activo::where('custodio_id', $empleado->id)
            ->vigentes()
            ->get(['id', 'valor_origen']);

        return response()->json([
            'data' => [
                'empleado'  => $empleado->nombre_completo,
                'centro'    => $empleado->centro?->codigo,
                'cantidad'  => $bienes->count(),
                'valor'     => round($bienes->sum('valor_origen'), 2),
                'puede_recibir' => $empleado->puedeRecibirBienes(),
            ],
        ]);
    }

    /**
     * Centros que el usuario alcanza, o null si los ve todos.
     *
     * La cadena es: usuario → sus almacenes → centros de esos almacenes.
     * Reutiliza la asignación usuario-almacén que ya existe en el sistema.
     */
    private function centrosDelUsuario($usuario): ?array
    {
        if ($usuario?->can('activos.ver-todos-centros')) {
            return null;
        }

        $almacenes = $usuario?->almacenes->pluck('id')->all() ?? [];

        if (empty($almacenes)) {
            return [];     // sin almacenes no ve ningún centro
        }

        return \App\Modules\Activos\Models\CentroCosto::whereIn('almacen_id', $almacenes)
            ->pluck('id')->all();
    }
}
