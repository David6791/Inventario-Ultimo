<?php

namespace App\Reportes;

use App\Models\CapaExistencia;
use Illuminate\Support\Collection;

/**
 * Cuánto vale el inventario.
 *
 * Se calcula desde las capas de costo, no desde `existencias.costo_promedio`.
 * Ese promedio es un dato derivado de presentación; las capas son la verdad del
 * costeo PEPS. Para un reporte que va a contabilidad, la diferencia importa.
 */
class ReporteValorizado extends Reporte
{
    public function titulo(): string
    {
        return 'Inventario Valorizado';
    }

    public function permiso(): string
    {
        return 'reportes.valorizado';
    }

    public function horizontal(): bool
    {
        return true;
    }

    public function columnas(): array
    {
        return [
            ['clave' => 'codigo',    'titulo' => 'Código',    'ancho' => '22mm'],
            ['clave' => 'producto',  'titulo' => 'Producto'],
            ['clave' => 'categoria', 'titulo' => 'Categoría', 'ancho' => '30mm'],
            ['clave' => 'unidad',    'titulo' => 'Unidad',    'ancho' => '14mm'],
            ['clave' => 'almacen',   'titulo' => 'Almacén',   'ancho' => '30mm'],
            ['clave' => 'cantidad',  'titulo' => 'Saldo',           'tipo' => 'cantidad', 'ancho' => '20mm'],
            ['clave' => 'costo',     'titulo' => 'Costo unitario',  'tipo' => 'moneda',   'ancho' => '24mm'],
            ['clave' => 'valor',     'titulo' => 'Valor total',     'tipo' => 'moneda',   'ancho' => '26mm'],
        ];
    }

    public function filas(): Collection
    {
        /*
        | Se agrupa por producto y almacén sumando el valor de cada capa viva.
        | El costo unitario que se muestra es el promedio ponderado resultante,
        | que es el número que contabilidad espera ver.
        */
        return CapaExistencia::query()
            ->with([
                'producto:id,codigo,nombre,categoria_id,unidad_medida_id',
                'producto.categoria:id,nombre',
                'producto.unidadMedida:id,codigo',
            ])
            ->where('cantidad_restante', '>', 0)
            ->when($this->almacenFiltrado(), fn ($q, $id) => $q->where('almacen_id', $id))
            ->when($this->request->filled('categoria_id'), fn ($q) => $q->whereHas(
                'producto', fn ($p) => $p->where('categoria_id', $this->request->integer('categoria_id'))
            ))
            ->get()
            ->groupBy(fn ($c) => $c->producto_id.'-'.$c->almacen_id)
            ->map(function ($capas) {
                $primera  = $capas->first();
                $cantidad = (float) $capas->sum('cantidad_restante');
                $valor    = (float) $capas->sum(
                    fn ($c) => (float) $c->cantidad_restante * (float) $c->costo_unitario
                );

                return [
                    'codigo'    => $primera->producto?->codigo,
                    'producto'  => $primera->producto?->nombre,
                    'categoria' => $primera->producto?->categoria?->nombre ?? '—',
                    'unidad'    => $primera->producto?->unidadMedida?->codigo,
                    'almacen'   => \App\Models\Almacen::find($primera->almacen_id)?->nombre,
                    'cantidad'  => $cantidad,
                    'costo'     => $cantidad > 0 ? round($valor / $cantidad, 4) : 0,
                    'valor'     => round($valor, 2),
                ];
            })
            ->sortBy([
                fn ($f) => $f['almacen'],
                fn ($f) => $f['producto'],
            ])
            ->values();
    }

    public function filtrosAplicados(): array
    {
        $filtros = [
            'Almacén' => $this->nombreAlmacen($this->almacenFiltrado()),
            'Método de costeo' => 'PEPS — primero en entrar, primero en salir',
        ];

        if ($this->request->filled('categoria_id')) {
            $filtros['Categoría'] = \App\Models\Categoria::find($this->request->integer('categoria_id'))?->nombre ?? '—';
        }

        return $filtros;
    }

    public function totales(): array
    {
        $filas = $this->filas();

        return [
            'cantidad' => (float) $filas->sum('cantidad'),
            'valor'    => round((float) $filas->sum('valor'), 2),
        ];
    }

    public function mensajeVacio(): string
    {
        return 'No hay existencias valorizadas. El valor nace al confirmar un ingreso con su precio.';
    }
}
