<?php

namespace App\Reportes;

use App\Models\MovimientoKardex;
use Illuminate\Support\Collection;

/**
 * Todo lo que entró y salió en un período.
 *
 * Es el reporte de respaldo para una revisión: muestra cada movimiento con su
 * documento, de modo que cualquier cifra se pueda rastrear hasta el papel
 * firmado.
 */
class ReporteMovimientos extends Reporte
{
    private const ETIQUETAS = [
        'ingreso'                 => 'Ingreso',
        'ingreso-anulacion'       => 'Anulación de ingreso',
        'salida'                  => 'Salida',
        'salida-anulacion'        => 'Anulación de salida',
        'transferencia-despacho'  => 'Transferencia (despacho)',
        'transferencia-recepcion' => 'Transferencia (recepción)',
        'transferencia-anulacion' => 'Anulación de transferencia',
    ];

    public function titulo(): string
    {
        return 'Reporte de Movimientos';
    }

    public function permiso(): string
    {
        return 'reportes.movimientos';
    }

    public function horizontal(): bool
    {
        return true;
    }

    public function columnas(): array
    {
        $columnas = [
            ['clave' => 'fecha',     'titulo' => 'Fecha',     'tipo' => 'fecha', 'ancho' => '24mm'],
            ['clave' => 'documento', 'titulo' => 'Documento', 'ancho' => '36mm'],
            ['clave' => 'concepto',  'titulo' => 'Concepto',  'ancho' => '40mm'],
            ['clave' => 'codigo',    'titulo' => 'Código',    'ancho' => '22mm'],
            ['clave' => 'producto',  'titulo' => 'Producto'],
            ['clave' => 'almacen',   'titulo' => 'Almacén',   'ancho' => '28mm'],
            ['clave' => 'entrada',   'titulo' => 'Entrada',   'tipo' => 'cantidad', 'ancho' => '18mm'],
            ['clave' => 'salida',    'titulo' => 'Salida',    'tipo' => 'cantidad', 'ancho' => '18mm'],
        ];

        // El importe solo para quien puede ver costos.
        if ($this->veCostos()) {
            $columnas[] = ['clave' => 'importe', 'titulo' => 'Importe', 'tipo' => 'moneda', 'ancho' => '24mm'];
        }

        return $columnas;
    }

    public function filas(): Collection
    {
        return MovimientoKardex::query()
            ->withoutGlobalScopes()
            ->with([
                'producto:id,codigo,nombre',
                'almacen:id,nombre',
            ])
            ->when($this->almacenFiltrado(), fn ($q, $id) => $q->where('almacen_id', $id))
            ->when($this->request->filled('desde'), fn ($q) => $q->whereDate('fecha', '>=', $this->request->date('desde')))
            ->when($this->request->filled('hasta'), fn ($q) => $q->whereDate('fecha', '<=', $this->request->date('hasta')))
            ->when($this->request->filled('tipo'), fn ($q) => $q->where('tipo', $this->request->string('tipo')))
            ->when($this->request->filled('producto_id'), fn ($q) => $q->where('producto_id', $this->request->integer('producto_id')))
            ->orderBy('fecha')
            ->orderBy('id')
            ->get()
            ->map(fn ($m) => [
                'fecha'     => $m->fecha?->format('d/m/Y H:i'),
                'documento' => $m->documento_numero,
                'concepto'  => self::ETIQUETAS[$m->documento_tipo] ?? $m->documento_tipo,
                'codigo'    => $m->producto?->codigo,
                'producto'  => $m->producto?->nombre,
                'almacen'   => $m->almacen?->nombre,
                'entrada'   => (float) $m->entrada,
                'salida'    => (float) $m->salida,
                'importe'   => $this->veCostos() ? (float) $m->costo_total : null,
            ])
            ->values();
    }

    public function filtrosAplicados(): array
    {
        $filtros = [
            'Período' => $this->rangoFechas(),
            'Almacén' => $this->nombreAlmacen($this->almacenFiltrado()),
        ];

        if ($this->request->filled('tipo')) {
            $filtros['Tipo'] = ucfirst($this->request->string('tipo')->value());
        }

        if ($this->request->filled('producto_id')) {
            $filtros['Producto'] = \App\Models\Producto::find($this->request->integer('producto_id'))?->nombre ?? '—';
        }

        return $filtros;
    }

    public function totales(): array
    {
        $filas = $this->filas();

        $totales = [
            'entrada' => (float) $filas->sum('entrada'),
            'salida'  => (float) $filas->sum('salida'),
        ];

        if ($this->veCostos()) {
            $totales['importe'] = round((float) $filas->sum('importe'), 2);
        }

        return $totales;
    }

    public function mensajeVacio(): string
    {
        return 'No hubo movimientos en el período consultado.';
    }
}
