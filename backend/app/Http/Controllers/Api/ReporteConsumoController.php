<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Reportes\ConsumoQuery;
use App\Reportes\ReporteConsumoAreas;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReporteConsumoController extends Controller
{
    /** Datos para la pantalla: las tres vistas y los totales en una sola llamada. */
    public function consultar(Request $peticion): JsonResponse
    {
        $filtros = $this->filtros($peticion);
        $consulta = new ConsumoQuery($filtros);

        return response()->json([
            'filtros'       => $filtros,
            'totales'       => $consulta->totales(),
            'areas'         => $consulta->porAreaConVariacion(),
            'solicitantes'  => $consulta->porSolicitante(),
            'productos'     => $consulta->porProducto(),
        ]);
    }

    public function pdf(Request $peticion)
    {
        $reporte = new ReporteConsumoAreas($this->filtros($peticion), $peticion->input('vista', 'area'));

        return $reporte->pdf();
    }

    public function excel(Request $peticion)
    {
        $reporte = new ReporteConsumoAreas($this->filtros($peticion), $peticion->input('vista', 'area'));

        return $reporte->excel();
    }

    private function filtros(Request $peticion): array
    {
        $datos = $peticion->validate([
            'desde'          => ['required', 'date'],
            'hasta'          => ['required', 'date', 'after_or_equal:desde'],
            'almacen_id'     => ['nullable', 'exists:almacenes,id'],
            'unidad_id'      => ['nullable', 'exists:unidades_solicitantes,id'],
            'solicitante_id' => ['nullable', 'exists:solicitantes,id'],
            'vista'          => ['nullable', 'in:area,solicitante,producto'],
        ]);

        // Un usuario sin permiso de ver todos los almacenes queda limitado al suyo.
        if (! $peticion->user()->tienePermiso('reportes.ver_todos_almacenes')) {
            $datos['almacen_id'] = $peticion->user()->almacen_id ?? $datos['almacen_id'] ?? null;
        }

        return $datos;
    }
}
