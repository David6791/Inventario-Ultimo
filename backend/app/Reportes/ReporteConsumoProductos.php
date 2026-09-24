<?php

namespace App\Reportes;

use Illuminate\Support\Collection;

/**
 * Qué ítems concentran el gasto.
 *
 * La columna "Áreas" dice en cuántas unidades distintas se consumió el producto:
 * un costo alto concentrado en una sola área es un dato distinto al mismo costo
 * repartido entre doce.
 */
class ReporteConsumoProductos extends ReporteConsumoAreas
{
    public function titulo(): string
    {
        return 'Consumo por Producto';
    }

    public function columnas(): array
    {
        return [
            ['clave' => 'codigo',        'titulo' => 'Código',    'ancho' => '22mm'],
            ['clave' => 'producto',      'titulo' => 'Producto'],
            ['clave' => 'categoria',     'titulo' => 'Categoría', 'ancho' => '32mm'],
            ['clave' => 'unidad',        'titulo' => 'Unidad',    'ancho' => '14mm'],
            ['clave' => 'areas',         'titulo' => 'Áreas',     'tipo' => 'cantidad', 'ancho' => '14mm'],
            ['clave' => 'cantidad',      'titulo' => 'Cantidad',  'tipo' => 'cantidad', 'ancho' => '20mm'],
            ['clave' => 'costo',         'titulo' => 'Costo unitario', 'tipo' => 'moneda', 'ancho' => '24mm'],
            ['clave' => 'neto',          'titulo' => 'Consumo neto',   'tipo' => 'moneda', 'ancho' => '26mm'],
            ['clave' => 'participacion', 'titulo' => '%',         'tipo' => 'cantidad', 'ancho' => '14mm'],
        ];
    }

    public function filas(): Collection
    {
        return $this->consulta()->porProducto();
    }

    public function filtrosAplicados(): array
    {
        return [
            ...parent::filtrosAplicados(),
            'Costo unitario' => 'Promedio ponderado de las capas consumidas en el periodo',
        ];
    }

    public function totales(): array
    {
        $filas = $this->filas();

        return [
            'cantidad' => round((float) $filas->sum('cantidad'), 4),
            'neto'     => round((float) $filas->sum('neto'), 2),
        ];
    }

    public function mensajeVacio(): string
    {
        return 'No se consumió ningún producto en el periodo seleccionado.';
    }
}
