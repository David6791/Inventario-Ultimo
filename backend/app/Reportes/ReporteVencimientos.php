<?php

namespace App\Reportes;

use App\Models\CapaExistencia;
use Illuminate\Support\Collection;

/**
 * Material próximo a vencer, o ya vencido.
 *
 * Sale de las capas de costo, que son las que llevan lote y fecha de
 * vencimiento. Un producto puede tener varias capas con vencimientos distintos:
 * cada una es una fila, porque cada una vence por su cuenta.
 *
 * Los ya vencidos aparecen primero: son los que hay que sacar del estante hoy.
 */
class ReporteVencimientos extends Reporte
{
    public function titulo(): string
    {
        return 'Reporte de Vencimientos';
    }

    public function permiso(): string
    {
        return 'reportes.vencimientos';
    }

    public function columnas(): array
    {
        return [
            ['clave' => 'codigo',      'titulo' => 'Código',      'ancho' => '22mm'],
            ['clave' => 'producto',    'titulo' => 'Producto'],
            ['clave' => 'lote',        'titulo' => 'Lote',        'ancho' => '26mm'],
            ['clave' => 'almacen',     'titulo' => 'Almacén',     'ancho' => '30mm'],
            ['clave' => 'cantidad',    'titulo' => 'Cantidad',    'tipo' => 'cantidad', 'ancho' => '20mm'],
            ['clave' => 'unidad',      'titulo' => 'Unidad',      'ancho' => '14mm'],
            ['clave' => 'vencimiento', 'titulo' => 'Vence',       'tipo' => 'fecha', 'ancho' => '22mm'],
            ['clave' => 'dias',        'titulo' => 'Días',        'tipo' => 'entero', 'ancho' => '16mm'],
            ['clave' => 'situacion',   'titulo' => 'Situación',   'ancho' => '28mm'],
        ];
    }

    public function filas(): Collection
    {
        // Por defecto, lo que vence en los próximos 90 días.
        $dias  = $this->request->integer('dias', 90);
        $corte = now()->addDays($dias)->endOfDay();

        return CapaExistencia::query()
            ->with([
                'producto:id,codigo,nombre,unidad_medida_id',
                'producto.unidadMedida:id,codigo',
            ])
            ->where('cantidad_restante', '>', 0)
            ->whereNotNull('fecha_vencimiento')
            ->where('fecha_vencimiento', '<=', $corte)
            ->when($this->almacenFiltrado(), fn ($q, $id) => $q->where('almacen_id', $id))
            ->orderBy('fecha_vencimiento')
            ->get()
            ->map(function ($capa) {
                // Días negativos: ya venció. Se muestran igual porque ese
                // material sigue en el estante y hay que darlo de baja.
                $dias = (int) now()->startOfDay()->diffInDays($capa->fecha_vencimiento, false);

                return [
                    'codigo'      => $capa->producto?->codigo,
                    'producto'    => $capa->producto?->nombre,
                    'lote'        => $capa->lote ?: '—',
                    'almacen'     => \App\Models\Almacen::find($capa->almacen_id)?->nombre,
                    'cantidad'    => (float) $capa->cantidad_restante,
                    'unidad'      => $capa->producto?->unidadMedida?->codigo,
                    'vencimiento' => $capa->fecha_vencimiento?->format('d/m/Y'),
                    'dias'        => $dias,
                    'situacion'   => match (true) {
                        $dias < 0   => 'VENCIDO',
                        $dias <= 30 => 'Crítico',
                        $dias <= 60 => 'Próximo',
                        default     => 'En plazo',
                    },
                ];
            })
            ->values();
    }

    public function filtrosAplicados(): array
    {
        return [
            'Almacén'      => $this->nombreAlmacen($this->almacenFiltrado()),
            'Anticipación' => 'Vencimientos dentro de '.$this->request->integer('dias', 90).' días',
            'Corte'        => now()->addDays($this->request->integer('dias', 90))->format('d/m/Y'),
        ];
    }

    public function totales(): array
    {
        return ['cantidad' => (float) $this->filas()->sum('cantidad')];
    }

    public function mensajeVacio(): string
    {
        return 'No hay material próximo a vencer. Solo aparecen productos con fecha de vencimiento registrada al ingresarlos.';
    }
}
