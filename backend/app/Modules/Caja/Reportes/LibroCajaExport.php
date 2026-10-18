<?php

namespace App\Modules\Caja\Reportes;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;

/**
 * Libro de caja en Excel: encabezado, una fila por movimiento con ingresos y
 * egresos separados por forma de pago, y la fila de totales con fórmulas.
 */
class LibroCajaExport implements FromArray, WithTitle, WithColumnWidths, WithColumnFormatting, WithEvents
{
    private const FILA_ENCABEZADO = 4;

    public function __construct(private readonly LibroCaja $libro, private readonly string $institucion)
    {
    }

    public function array(): array
    {
        $filas = [
            [$this->institucion],
            ['Libro de caja ' . $this->libro->titulo() . ' · ' . ($this->libro->totales['moneda'] === 'USD' ? 'Dólares' : 'Bolivianos')],
            [],
            ['Fecha', 'Hora', 'Comprobante', 'Caja', 'Concepto', 'Persona', 'CI', 'Forma de pago', 'Glosa',
             'Ingreso efectivo', 'Egreso efectivo', 'Ingreso otras formas', 'Egreso otras formas', 'Estado'],
        ];

        foreach ($this->libro->movimientos as $m) {
            $efectivo = $m->forma_pago === 'EFECTIVO';
            $anulado = $m->estado === 'ANULADO';
            $monto = $anulado ? 0 : (float) $m->monto;
            $filas[] = [
                $m->fecha?->format('d/m/Y'), $m->fecha?->format('H:i'), $m->numero, $m->caja?->codigo,
                $m->concepto?->nombre, $m->persona_nombre, $m->persona_ci,
                ucfirst(mb_strtolower($m->forma_pago)) . ($m->banco ? " · {$m->banco->nombre} {$m->nro_documento}" : ''),
                $m->glosa,
                $m->tipo === 'INGRESO' && $efectivo ? $monto : null,
                $m->tipo === 'EGRESO' && $efectivo ? $monto : null,
                $m->tipo === 'INGRESO' && ! $efectivo ? $monto : null,
                $m->tipo === 'EGRESO' && ! $efectivo ? $monto : null,
                $anulado ? 'ANULADO (no suma): ' . $m->motivo_anulacion : 'Vigente',
            ];
        }

        $primera = self::FILA_ENCABEZADO + 1;
        $ultima = self::FILA_ENCABEZADO + max(1, $this->libro->movimientos->count());
        $filas[] = ['Totales', '', '', '', '', '', '', '', '',
            "=SUM(J{$primera}:J{$ultima})", "=SUM(K{$primera}:K{$ultima})",
            "=SUM(L{$primera}:L{$ultima})", "=SUM(M{$primera}:M{$ultima})", ''];

        return $filas;
    }

    public function title(): string
    {
        return 'Libro de caja';
    }

    public function columnWidths(): array
    {
        return ['A' => 11, 'B' => 7, 'C' => 18, 'D' => 7, 'E' => 30, 'F' => 30, 'G' => 12, 'H' => 22, 'I' => 36,
                'J' => 15, 'K' => 15, 'L' => 15, 'M' => 15, 'N' => 26];
    }

    public function columnFormats(): array
    {
        return array_fill_keys(['J', 'K', 'L', 'M'], '#,##0.00');
    }

    public function registerEvents(): array
    {
        return [AfterSheet::class => function (AfterSheet $e) {
            $hoja = $e->sheet->getDelegate();
            $fin = self::FILA_ENCABEZADO + $this->libro->movimientos->count() + 1;
            $hoja->getStyle('A1')->getFont()->setBold(true)->setSize(12);
            $hoja->getStyle('A2')->getFont()->setBold(true);
            $hoja->getStyle('A' . self::FILA_ENCABEZADO . ':N' . self::FILA_ENCABEZADO)->applyFromArray([
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '16323F']],
            ]);
            $hoja->getStyle("A{$fin}:N{$fin}")->getFont()->setBold(true);
            $hoja->freezePane('A' . (self::FILA_ENCABEZADO + 1));
            $hoja->setAutoFilter('A' . self::FILA_ENCABEZADO . ':N' . ($fin - 1));
        }];
    }
}
