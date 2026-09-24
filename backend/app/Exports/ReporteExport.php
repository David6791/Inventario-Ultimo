<?php

namespace App\Exports;

use App\Reportes\Reporte;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Un solo exportador para los cuatro reportes.
 *
 * Lee las columnas y las filas del mismo objeto `Reporte` que alimenta la
 * pantalla y el PDF, así los tres formatos no pueden divergir.
 *
 * La hoja se arma para trabajar, no solo para mirar: encabezados congelados,
 * filtros automáticos, columnas numéricas como números de verdad (no texto) y
 * el total al pie con fórmula visible.
 */
class ReporteExport implements
    FromArray, WithTitle, WithStyles, WithColumnWidths, WithColumnFormatting, WithEvents
{
    use Exportable;

    private array $columnas;
    private array $filas;
    private array $totales;
    private array $filtros;
    private int $filaEncabezado;
    private int $filaPrimerDato;

    public function __construct(private Reporte $reporte)
    {
        $this->columnas = $reporte->columnas();
        $this->filas    = $reporte->filas()->all();
        $this->totales  = $reporte->totales();
        $this->filtros  = $reporte->filtrosAplicados();

        // Título, filtros, línea en blanco, encabezado.
        $this->filaEncabezado = 2 + count($this->filtros) + 1;
        $this->filaPrimerDato = $this->filaEncabezado + 1;
    }

    public function array(): array
    {
        $hoja = [];
        $ancho = count($this->columnas);

        // Encabezado del documento: sin los filtros a la vista, el archivo no
        // sirve como respaldo porque nadie sabe qué se consultó.
        $hoja[] = array_pad([$this->reporte->titulo()], $ancho, '');

        foreach ($this->filtros as $rotulo => $valor) {
            $hoja[] = array_pad(["{$rotulo}: {$valor}"], $ancho, '');
        }

        $hoja[] = array_pad([
            'Emitido el '.now()->format('d/m/Y H:i'),
        ], $ancho, '');

        $hoja[] = array_column($this->columnas, 'titulo');

        if (empty($this->filas)) {
            $hoja[] = array_pad([$this->reporte->mensajeVacio()], $ancho, '');
            return $hoja;
        }

        foreach ($this->filas as $fila) {
            $hoja[] = array_map(
                fn ($c) => $fila[$c['clave']] ?? '',
                $this->columnas
            );
        }

        if ($this->totales) {
            $hoja[] = $this->filaTotales();
        }

        return $hoja;
    }

    private function filaTotales(): array
    {
        $fila = [];
        $primeraNumerica = null;

        foreach ($this->columnas as $indice => $columna) {
            $clave = $columna['clave'];

            if (isset($this->totales[$clave])) {
                $fila[] = $this->totales[$clave];
                $primeraNumerica ??= $indice;
            } else {
                $fila[] = '';
            }
        }

        // El rótulo va en la celda anterior a la primera cifra.
        if ($primeraNumerica !== null && $primeraNumerica > 0) {
            $fila[$primeraNumerica - 1] = 'TOTAL';
        }

        return $fila;
    }

    public function title(): string
    {
        return mb_substr($this->reporte->titulo(), 0, 31);
    }

    public function columnWidths(): array
    {
        $anchos = [];

        foreach ($this->columnas as $indice => $columna) {
            $letra = $this->letra($indice);

            $anchos[$letra] = match ($columna['tipo'] ?? 'texto') {
                'moneda', 'cantidad' => 16,
                'fecha'              => 14,
                'entero'             => 10,
                default              => $columna['clave'] === 'producto' ? 42 : 20,
            };
        }

        return $anchos;
    }

    /** Las cifras van como números, no como texto: si no, no se pueden sumar. */
    public function columnFormats(): array
    {
        $formatos = [];

        foreach ($this->columnas as $indice => $columna) {
            $formato = match ($columna['tipo'] ?? 'texto') {
                'moneda'   => '#,##0.00',
                'cantidad' => '#,##0.####',
                'entero'   => '#,##0',
                default    => null,
            };

            if ($formato) {
                $formatos[$this->letra($indice)] = $formato;
            }
        }

        return $formatos;
    }

    public function styles(Worksheet $hoja): array
    {
        $ultimaColumna = $this->letra(count($this->columnas) - 1);
        $ultimaFila    = $this->filaPrimerDato + max(0, count($this->filas) - 1);

        $estilos = [
            1 => ['font' => ['bold' => true, 'size' => 14]],

            $this->filaEncabezado => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType'   => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '16323F'],   // tinta petróleo
                ],
            ],
        ];

        // Los filtros, en gris y más chicos: son contexto, no contenido.
        for ($f = 2; $f < $this->filaEncabezado; $f++) {
            $estilos[$f] = ['font' => ['size' => 9, 'color' => ['rgb' => '667788']]];
        }

        if ($this->totales && ! empty($this->filas)) {
            $estilos[$ultimaFila + 1] = [
                'font'    => ['bold' => true],
                'borders' => [
                    'top' => ['borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN],
                ],
            ];
        }

        return $estilos;
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $evento) {
                $hoja = $evento->sheet->getDelegate();
                $ultimaColumna = $this->letra(count($this->columnas) - 1);
                $ultimaFila = $this->filaPrimerDato + max(0, count($this->filas) - 1);

                // Congelar el encabezado: con cientos de filas, desplazarse sin
                // ver los títulos vuelve la hoja inservible.
                $hoja->freezePane("A{$this->filaPrimerDato}");

                if (! empty($this->filas)) {
                    $hoja->setAutoFilter(
                        "A{$this->filaEncabezado}:{$ultimaColumna}{$ultimaFila}"
                    );
                }

                $hoja->getPageSetup()->setOrientation(
                    $this->reporte->horizontal() ? 'landscape' : 'portrait'
                );
                $hoja->getPageSetup()->setFitToWidth(1);
                $hoja->getPageSetup()->setFitToHeight(0);

                // Repetir el encabezado en cada página impresa.
                $hoja->getPageSetup()->setRowsToRepeatAtTopByStartAndEnd(
                    $this->filaEncabezado, $this->filaEncabezado
                );
            },
        ];
    }

    private function letra(int $indice): string
    {
        return \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($indice + 1);
    }
}
