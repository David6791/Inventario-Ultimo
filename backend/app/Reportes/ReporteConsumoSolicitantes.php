<?php

namespace App\Reportes;

use Illuminate\Support\Collection;

/**
 * El mismo consumo, abierto por persona.
 *
 * Es el reporte que se pide cuando una unidad pregunta por qué subió su gasto:
 * muestra quién retiró y cuánto, dentro de cada unidad.
 */
class ReporteConsumoSolicitantes extends ReporteConsumoAreas
{
    public function titulo(): string
    {
        return 'Consumo por Solicitante';
    }

    public function columnas(): array
    {
        return [
            ['clave' => 'solicitante',   'titulo' => 'Solicitante'],
            ['clave' => 'unidad',        'titulo' => 'Unidad',        'ancho' => '48mm'],
            ['clave' => 'salidas',       'titulo' => 'Salidas',       'tipo' => 'cantidad', 'ancho' => '18mm'],
            ['clave' => 'salida',        'titulo' => 'Salidas',       'tipo' => 'moneda',   'ancho' => '26mm'],
            ['clave' => 'devolucion',    'titulo' => 'Devoluciones',  'tipo' => 'moneda',   'ancho' => '26mm'],
            ['clave' => 'neto',          'titulo' => 'Consumo neto',  'tipo' => 'moneda',   'ancho' => '28mm'],
            ['clave' => 'participacion', 'titulo' => '%',             'tipo' => 'cantidad', 'ancho' => '16mm'],
        ];
    }

    public function filas(): Collection
    {
        return $this->consulta()->porSolicitante();
    }

    public function totales(): array
    {
        $filas = $this->filas();

        return [
            'salida'     => round((float) $filas->sum('salida'), 2),
            'devolucion' => round((float) $filas->sum('devolucion'), 2),
            'neto'       => round((float) $filas->sum('neto'), 2),
        ];
    }

    public function mensajeVacio(): string
    {
        return 'Ningún solicitante retiró material en el periodo seleccionado.';
    }
}
