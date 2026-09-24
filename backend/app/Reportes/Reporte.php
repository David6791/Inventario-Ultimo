<?php

namespace App\Reportes;

use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Base de todos los reportes.
 *
 * Cada reporte define sus columnas y sus filas una sola vez; la pantalla, el PDF
 * y el Excel leen de acá. Es lo que garantiza que el total impreso no difiera
 * del que se ve en pantalla — que es el error más difícil de detectar y el más
 * grave en una revisión.
 */
abstract class Reporte
{
    public function __construct(
        protected Request $request,
    ) {}

    /** Título que encabeza el documento. */
    abstract public function titulo(): string;

    /** Permiso que habilita este reporte. */
    abstract public function permiso(): string;

    /**
     * Definición de columnas.
     *
     * @return list<array{clave: string, titulo: string, tipo?: string, ancho?: string}>
     *   tipo: texto (por defecto), cantidad, moneda, fecha, entero
     */
    abstract public function columnas(): array;

    /** Las filas, ya resueltas. */
    abstract public function filas(): Collection;

    /**
     * Los filtros aplicados, en texto legible, para imprimirlos en el
     * encabezado. Un reporte sin sus criterios a la vista no sirve como
     * respaldo: nadie sabe qué se consultó.
     *
     * @return array<string, string>
     */
    abstract public function filtrosAplicados(): array;

    /**
     * Totales al pie, por clave de columna.
     *
     * @return array<string, float>
     */
    public function totales(): array
    {
        return [];
    }

    /** Nombre del archivo descargado, sin extensión. */
    public function nombreArchivo(): string
    {
        return str($this->titulo())->slug()->value().'-'.now()->format('Ymd-His');
    }

    /** Mensaje cuando no hay datos. Explica por qué, no solo que está vacío. */
    public function mensajeVacio(): string
    {
        return 'No hay datos que coincidan con los filtros aplicados.';
    }

    /** ¿Se orienta la hoja en horizontal? Los reportes anchos lo necesitan. */
    public function horizontal(): bool
    {
        return false;
    }

    // --- Utilidades para las implementaciones -------------------------------

    protected function almacenFiltrado(): ?int
    {
        return $this->request->filled('almacen_id')
            ? $this->request->integer('almacen_id')
            : null;
    }

    /** ¿El usuario puede ver precios? Varias columnas dependen de esto. */
    protected function veCostos(): bool
    {
        return $this->request->user()?->can('stock.ver-costos') ?? false;
    }

    protected function nombreAlmacen(?int $id): string
    {
        if (! $id) {
            return 'Todos los almacenes';
        }

        return \App\Models\Almacen::find($id)?->nombre ?? 'Almacén desconocido';
    }

    protected function rangoFechas(): string
    {
        $desde = $this->request->input('desde');
        $hasta = $this->request->input('hasta');

        if (! $desde && ! $hasta) {
            return 'Sin límite de fechas';
        }

        $inicio = $desde ? \Carbon\Carbon::parse($desde)->format('d/m/Y') : 'el inicio';
        $fin    = $hasta ? \Carbon\Carbon::parse($hasta)->format('d/m/Y') : 'hoy';

        return "Del {$inicio} al {$fin}";
    }
}
