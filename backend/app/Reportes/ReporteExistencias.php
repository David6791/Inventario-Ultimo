<?php

namespace App\Reportes;

use App\Models\Existencia;
use Illuminate\Support\Collection;

/**
 * Qué hay en el almacén, sin precios.
 *
 * Es el reporte que se imprime para hacer un recuento físico o para responder
 * "¿qué tenemos?" sin exponer costos.
 */
class ReporteExistencias extends Reporte
{
    public function titulo(): string
    {
        return 'Reporte de Existencias';
    }

    public function permiso(): string
    {
        return 'reportes.existencias';
    }

    public function columnas(): array
    {
        return [
            ['clave' => 'codigo',    'titulo' => 'Código',    'ancho' => '22mm'],
            ['clave' => 'producto',  'titulo' => 'Producto'],
            ['clave' => 'categoria', 'titulo' => 'Categoría', 'ancho' => '32mm'],
            ['clave' => 'unidad',    'titulo' => 'Unidad',    'ancho' => '14mm'],
            ['clave' => 'almacen',   'titulo' => 'Almacén',   'ancho' => '32mm'],
            ['clave' => 'cantidad',  'titulo' => 'Saldo',     'tipo' => 'cantidad', 'ancho' => '20mm'],
            ['clave' => 'minimo',    'titulo' => 'Mínimo',    'tipo' => 'cantidad', 'ancho' => '18mm'],
            ['clave' => 'estado',    'titulo' => 'Estado',    'ancho' => '24mm'],
        ];
    }

    public function filas(): Collection
    {
        return Existencia::query()
            ->withoutGlobalScopes()
            ->with([
                'producto:id,codigo,nombre,categoria_id,unidad_medida_id,stock_minimo',
                'producto.categoria:id,nombre',
                'producto.unidadMedida:id,codigo',
                'almacen:id,nombre',
            ])
            ->whereHas('producto')
            ->when($this->almacenFiltrado(), fn ($q, $id) => $q->where('almacen_id', $id))
            ->when($this->request->filled('categoria_id'), fn ($q) => $q->whereHas(
                'producto', fn ($p) => $p->where('categoria_id', $this->request->integer('categoria_id'))
            ))
            ->when($this->request->filled('estado'), fn ($q) => $this->porEstado($q))
            // Por defecto se omiten los productos que nunca tuvieron saldo:
            // llenarían el reporte de ceros sin aportar nada.
            ->when(! $this->request->boolean('incluir_sin_saldo'), fn ($q) => $q->where('cantidad', '>', 0))
            ->get()
            ->sortBy([
                fn ($e) => $e->almacen?->nombre,
                fn ($e) => $e->producto?->nombre,
            ])
            ->map(fn ($e) => [
                'codigo'    => $e->producto?->codigo,
                'producto'  => $e->producto?->nombre,
                'categoria' => $e->producto?->categoria?->nombre ?? '—',
                'unidad'    => $e->producto?->unidadMedida?->codigo,
                'almacen'   => $e->almacen?->nombre,
                'cantidad'  => (float) $e->cantidad,
                'minimo'    => (float) ($e->producto?->stock_minimo ?? 0),
                'estado'    => $this->estado($e),
            ])
            ->values();
    }

    private function estado($existencia): string
    {
        $cantidad = (float) $existencia->cantidad;
        $minimo   = (float) ($existencia->producto?->stock_minimo ?? 0);

        return match (true) {
            $cantidad <= 0                      => 'Agotado',
            $minimo > 0 && $cantidad <= $minimo => 'Bajo mínimo',
            default                             => 'Normal',
        };
    }

    private function porEstado($query)
    {
        return match ($this->request->string('estado')->value()) {
            'agotado' => $query->where('cantidad', '<=', 0),
            'bajo'    => $query->where('cantidad', '>', 0)
                ->whereRaw('existencias.cantidad <= (select stock_minimo from productos where productos.id = existencias.producto_id)'),
            default   => $query,
        };
    }

    public function filtrosAplicados(): array
    {
        $filtros = ['Almacén' => $this->nombreAlmacen($this->almacenFiltrado())];

        if ($this->request->filled('categoria_id')) {
            $filtros['Categoría'] = \App\Models\Categoria::find($this->request->integer('categoria_id'))?->nombre ?? '—';
        }

        if ($this->request->filled('estado')) {
            $filtros['Estado'] = match ($this->request->string('estado')->value()) {
                'agotado' => 'Solo agotados',
                'bajo'    => 'Solo bajo el mínimo',
                default   => 'Todos',
            };
        }

        return $filtros;
    }

    public function totales(): array
    {
        return ['cantidad' => (float) $this->filas()->sum('cantidad')];
    }

    public function mensajeVacio(): string
    {
        return 'No hay existencias con saldo. Registre un ingreso para que aparezca material.';
    }
}
