<?php

namespace App\Modules\Activos\Services;

use App\Modules\Activos\Models\Area;
use App\Modules\Activos\Models\CentroCosto;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Plantilla de importación de personal.
 *
 * Trae solo las columnas que el módulo necesita para la custodia. El formato
 * de planilla que usa la empresa tiene 42 columnas, la mayoría de nómina
 * —Haber Básico, AFP, NUA—, y ese archivo también se puede importar: el
 * lector ubica las columnas por su encabezado y descarta el resto.
 *
 * Esta plantilla existe para quien empieza de cero y no quiere cargar un
 * archivo de planilla completo solo para dar de alta personal.
 */
class PlantillaPersonalService
{
    /** clave => [encabezado, ayuda, ancho] */
    private const COLUMNAS = [
        ['Código (*)',          'Identificador del empleado. Único. Si ya existe, la fila actualiza sus datos.', 12],
        ['Apellido Paterno',    'Apellido paterno', 18],
        ['Apellido Materno',    'Apellido materno', 18],
        ['Nombre (*)',          'Nombres', 20],
        ['C.I. (*)',            'Cédula de identidad. Única: no puede repetirse ni en el archivo ni en el sistema.', 14],
        ['Expedido',            'Departamento de expedición: PT, LP, CB, SC…', 10],
        ['Cargo(*)',            'Cargo que ocupa', 24],
        ['Area',                'Debe existir o se creará. Ver hoja Centros.', 14],
        ['Centro de Costo',     'Debe existir o se creará. Ver hoja Centros.', 20],
        ['Fecha Ingreso (dd/mm/yyyy)', 'Fecha de ingreso a la empresa', 16],
        ['Móvil',               'Teléfono celular', 14],
        ['Telefono 1',          'Teléfono fijo', 14],
        ['E_mail',              'Correo electrónico', 24],
        ['Profesión',           'Profesión u oficio', 20],
        ['Dirección',           'Domicilio', 28],
        ['Observacion',         'Observaciones', 24],
    ];

    public function generar(): string
    {
        $libro = new Spreadsheet();

        $this->hojaCarga($libro);
        $this->hojaCentros($libro);

        $libro->setActiveSheetIndex(0);

        $ruta = storage_path('app/plantilla-personal-' . now()->format('Ymd-His') . '.xlsx');
        (new Xlsx($libro))->save($ruta);

        return $ruta;
    }

    private function hojaCarga(Spreadsheet $libro): void
    {
        $hoja = $libro->getActiveSheet();
        $hoja->setTitle('Personal');

        $columna = 'A';

        foreach (self::COLUMNAS as [$encabezado, $ayuda, $ancho]) {
            $hoja->setCellValue("{$columna}1", $encabezado);
            $hoja->getComment("{$columna}1")->getText()->createTextRun($ayuda);
            $hoja->getColumnDimension($columna)->setWidth($ancho);
            $columna++;
        }

        $ultima = chr(ord('A') + count(self::COLUMNAS) - 1);

        $hoja->getStyle("A1:{$ultima}1")->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1F4E79']],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical'   => Alignment::VERTICAL_CENTER,
                'wrapText'   => true,
            ],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        $hoja->getRowDimension(1)->setRowHeight(34);
        $hoja->freezePane('A2');

        $this->filaEjemplo($hoja, $ultima);

        // El código y el C.I. como texto: Excel convierte "0012" en 12 y
        // "7654321" podría perder un cero inicial.
        foreach (['A', 'E'] as $col) {
            $hoja->getStyle("{$col}2:{$col}2000")->getNumberFormat()->setFormatCode('@');
        }

        $hoja->getStyle('J2:J2000')->getNumberFormat()->setFormatCode('dd/mm/yyyy');
    }

    private function filaEjemplo($hoja, string $ultima): void
    {
        $texto = [
            'A2' => 'EMP-001',
            'B2' => 'Mamani',
            'C2' => 'Quispe',
            'D2' => 'Juan Carlos',
            'E2' => '7654321',
            'F2' => 'PT',
            'G2' => 'Operario de acopio',
            'H2' => 'PORCO',
            'I2' => 'ACOPIO_PORCO',
            'K2' => '71234567',
            'M2' => 'jmamani@empresa.bo',
            'P2' => 'Fila de ejemplo: BORRAR antes de cargar',
        ];

        foreach ($texto as $celda => $valor) {
            $hoja->setCellValueExplicit($celda, $valor, DataType::TYPE_STRING);
        }

        $hoja->setCellValue('J2', Date::PHPToExcel(new \DateTime('2026-03-01')));

        $hoja->getStyle("A2:{$ultima}2")->applyFromArray([
            'font' => ['italic' => true, 'color' => ['rgb' => '9CA3AF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FAFAFA']],
        ]);
    }

    /**
     * Hoja de referencia con las áreas y centros existentes.
     *
     * Sin esto el usuario inventa códigos y el importador crea centros
     * duplicados con nombres parecidos — «ACOPIO_PORCO» y «Acopio Porco»
     * serían dos centros distintos, cada uno con sus bienes.
     */
    private function hojaCentros(Spreadsheet $libro): void
    {
        $hoja = $libro->createSheet();
        $hoja->setTitle('Centros');

        $hoja->fromArray(['Área', 'Centro de Costo', 'Nombre del centro', 'Almacén asignado'], null, 'A1');

        $fila = 2;

        foreach (Area::activas()->orderBy('codigo')->get() as $area) {
             $centros = CentroCosto::vigentes()
                ->where('area_id', $area->id)
                ->orderBy('codigo')
                ->get();

            if ($centros->isEmpty()) {
                $hoja->fromArray(
                    [$area->codigo, '', '⚠ el área no tiene centros de costo', ''],
                    null, "A{$fila}"
                );
                $hoja->getStyle("C{$fila}")->getFont()->getColor()->setARGB('FFB45309');
                $fila++;
                continue;
            }

            foreach ($centros as $c) {
                $almacen = $c->almacen_id
                    ? \Illuminate\Support\Facades\DB::table('almacenes')
                        ->where('id', $c->almacen_id)->value('nombre')
                    : '⚠ sin almacén: sus bienes no serán visibles';

                $hoja->fromArray([$area->codigo, $c->codigo, $c->nombre, $almacen], null, "A{$fila}");

                if (! $c->almacen_id) {
                    $hoja->getStyle("D{$fila}")->getFont()->getColor()->setARGB('FFB45309');
                }

                $fila++;
            }
        }

        if ($fila === 2) {
            $hoja->setCellValue('A2', 'Todavía no hay áreas ni centros registrados.');
            $hoja->setCellValue('A3', 'Escriba los códigos que quiera en la hoja Personal: se crearán al importar.');
            $hoja->setCellValue('A4', 'Después asígneles almacén desde la pantalla de centros de costo.');
            $fila = 5;
        }

        $hoja->getStyle('A1:D1')->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E7EEF6']],
            'borders' => ['bottom' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        foreach (range('A', 'D') as $col) {
            $hoja->getColumnDimension($col)->setAutoSize(true);
        }

        $hoja->freezePane('A2');
    }
}
