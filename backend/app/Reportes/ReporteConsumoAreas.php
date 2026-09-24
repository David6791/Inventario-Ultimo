<?php

namespace App\Reportes;

use Illuminate\Support\Collection;

/**
 * Cuánto consumió cada unidad solicitante en el periodo.
 *
 * El costo sale de las capas PEPS que cada salida consumió, no de un precio de
 * lista: es el único número que va a cuadrar con contabilidad. Las devoluciones
 * se restan en el periodo en que se registraron.
 */
class ReporteConsumoAreas extends Reporte
{
    public function titulo(): string
    {
        return 'Consumo por Unidad Solicitante';
    }

    public function permiso(): string
    {
        return 'reportes.consumo';
    }

    public function horizontal(): bool
    {
        return true;
    }

    public function columnas(): array
    {
        return [
            ['clave' => 'unidad',        'titulo' => 'Unidad solicitante'],
            ['clave' => 'solicitantes',  'titulo' => 'Solic.',        'tipo' => 'cantidad', 'ancho' => '16mm'],
            ['clave' => 'salidas',       'titulo' => 'Salidas',       'tipo' => 'cantidad', 'ancho' => '18mm'],
            ['clave' => 'cantidad',      'titulo' => 'Cantidad',      'tipo' => 'cantidad', 'ancho' => '22mm'],
            ['clave' => 'salida',        'titulo' => 'Salidas',       'tipo' => 'moneda',   'ancho' => '26mm'],
            ['clave' => 'devolucion',    'titulo' => 'Devoluciones',  'tipo' => 'moneda',   'ancho' => '26mm'],
            ['clave' => 'neto',          'titulo' => 'Consumo neto',  'tipo' => 'moneda',   'ancho' => '28mm'],
            ['clave' => 'participacion', 'titulo' => '%',             'tipo' => 'cantidad', 'ancho' => '16mm'],
            ['clave' => 'variacion',     'titulo' => 'Var. %',        'tipo' => 'cantidad', 'ancho' => '18mm'],
        ];
    }

    public function filas(): Collection
    {
        return $this->consulta()
            ->porAreaConVariacion()
            ->map(function (array $fila) {
                // El id interno no va a la tabla: solo servía para cruzar periodos.
                unset($fila['_unidad_id']);

                return $fila;
            });
    }

        public function filtrosAplicados(): array
    {
        $filtros = [
            'Período'    => $this->rangoFechas(),
            'Almacén'    => $this->nombreAlmacen($this->almacenFiltrado()),
            'Valoración' => 'Costo PEPS de las capas consumidas, neto de devoluciones',
        ];

        if ($this->request->filled('unidad_id')) {
            $filtros['Unidad'] = \App\Models\UnidadSolicitante::find(
                $this->request->integer('unidad_id')
            )?->nombre ?? '—';
        }

        return $filtros;
    }

    public function totales(): array
    {
        $filas = $this->filas();

        return [
            'cantidad'   => round((float) $filas->sum('cantidad'), 4),
            'salida'     => round((float) $filas->sum('salida'), 2),
            'devolucion' => round((float) $filas->sum('devolucion'), 2),
            'neto'       => round((float) $filas->sum('neto'), 2),
        ];
    }

    public function mensajeVacio(): string
    {
        return 'No hubo salidas confirmadas en el periodo seleccionado.';
    }

    protected function consulta(): ConsumoQuery
    {
        return new ConsumoQuery($this->request, $this->almacenFiltrado());
    }

    protected function periodoLegible(string $desde, string $hasta): string
    {
        return 'del '.date('d/m/Y', strtotime($desde)).' al '.date('d/m/Y', strtotime($hasta));
    }
}
