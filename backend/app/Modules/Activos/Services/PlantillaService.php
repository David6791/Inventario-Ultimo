<?php

namespace App\Modules\Activos\Services;

use App\Modules\Activos\Models\Clase;
use App\Modules\Activos\Models\Subclase;
use App\Modules\Activos\Models\Ubicacion;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Genera la plantilla de importación con los catálogos adentro.
 *
 * Tres hojas: la de carga, y dos de referencia con las clases/subclases y las
 * ubicaciones existentes. Sin eso el usuario adivina los códigos y el archivo
 * vuelve lleno de errores que recién se descubren al validar.
 */
class PlantillaService
{
    /** clave => [ayuda, ancho] */
    private const ENCABEZADOS = [
        'clase'               => ['Código de clase (ver hoja Clases)', 10],
        'subclase'            => ['Código de subclase (ver hoja Clases)', 11],
        'denominacion'        => ['Denominación del bien', 30],
        'marca'               => ['Marca', 14],
        'modelo'              => ['Modelo', 16],
        'serie'               => ['Número de serie. Único: no puede repetirse ni en el archivo ni en el sistema', 18],
        'placa'               => ['Placa', 12],
        'anio_fabricacion'    => ['Año de fabricación', 12],
        'origen'              => ['COMPRA, IMPORTACION, CONSTRUCCION, DONACION, PERMUTA, APORTE', 15],
        'factura_nro'         => ['N° de factura', 14],
        'factura_fecha'       => ['dd/mm/aaaa', 14],
        'acta_nro'            => ['N° de acta de recepción. Obligatorio en compras e importaciones', 14],
        'acta_fecha'          => ['dd/mm/aaaa', 14],
        'fecha_incorporacion' => ['dd/mm/aaaa — fecha del acta de recepción', 18],
        'fecha_inicio_uso'    => ['dd/mm/aaaa — cuando entra en servicio. Es la base del cómputo de la depreciación', 18],
        'ubicacion'           => ['Código de ubicación (ver hoja Ubicaciones)', 14],
        'condicion'           => ['NUEVO, BUENO, REGULAR, MALO, INSERVIBLE', 13],
        'moneda'              => ['BOB o USD', 10],
        'tipo_cambio'         => ['1 si la moneda es BOB', 12],
        'precio'              => ['Precio de factura. Obligatorio y mayor a cero', 13],
        'flete'               => ['Flete', 12],
        'seguro'              => ['Seguro de traslado', 12],
        'instalacion'         => ['Instalación y montaje', 13],
        'otros'               => ['Otros costos capitalizables', 12],
        'observaciones'       => ['Observaciones', 28],
    ];

    public function generar(): string
    {
        $libro = new Spreadsheet();

        $this->hojaCarga($libro);
        $this->hojaClases($libro);
        $this->hojaUbicaciones($libro);

        $libro->setActiveSheetIndex(0);

        $ruta = storage_path('app/plantilla-activos-' . now()->format('Ymd-His') . '.xlsx');
        (new Xlsx($libro))->save($ruta);

        return $ruta;
    }

    private function hojaCarga(Spreadsheet $libro): void
    {
        $hoja = $libro->getActiveSheet();
        $hoja->setTitle('Activos');

        $columna = 'A';
        foreach (self::ENCABEZADOS as $clave => [$ayuda, $ancho]) {
            $hoja->setCellValue("{$columna}1", $clave);

            // La ayuda va como comentario para no ensuciar la fila de títulos,
            // que es exactamente la que lee el importador.
            $hoja->getComment("{$columna}1")->getText()->createTextRun($ayuda);
            $hoja->getColumnDimension($columna)->setWidth($ancho);

            $columna++;
        }

        $ultima = chr(ord('A') + count(self::ENCABEZADOS) - 1);   // Y

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
        $this->formatearColumnasDeDatos($hoja);
    }

    /**
     * Fila de ejemplo con los tipos CORRECTOS.
     *
     * Importa que los montos sean numéricos y las fechas sean fechas de Excel:
     * el usuario copia el formato de esta fila al llenar las suyas, y si acá
     * todo es texto, los montos llegan como cadenas y las fechas también.
     */
    private function filaEjemplo($hoja, string $ultima): void
    {
        $texto = [
            'A2' => '05',
            'B2' => '02',
            'C2' => 'Laptop Dell Latitude 5440',
            'D2' => 'Dell',
            'E2' => 'Latitude 5440',
            'F2' => 'SN-EJEMPLO-001',
            'I2' => 'COMPRA',
            'J2' => 'F-001',
            'L2' => 'AR-001',
            'P2' => 'OC-P2',
            'Q2' => 'NUEVO',
            'R2' => 'BOB',
            'Y2' => 'Fila de ejemplo: BORRAR antes de cargar',
        ];

        foreach ($texto as $celda => $valor) {
            // Explícito como texto: sin esto Excel convierte "05" en 5 y se
            // pierde el cero a la izquierda del código de clase.
            $hoja->setCellValueExplicit($celda, $valor, DataType::TYPE_STRING);
        }

        $numeros = ['H2' => 2026, 'S2' => 1, 'T2' => 5000, 'U2' => 300];

        foreach ($numeros as $celda => $valor) {
            $hoja->setCellValueExplicit($celda, $valor, DataType::TYPE_NUMERIC);
        }

        $fechas = [
            'K2' => '2026-03-15',   // factura
            'M2' => '2026-03-15',   // acta
            'N2' => '2026-03-15',   // incorporación
            'O2' => '2026-03-20',   // inicio de uso
        ];

        foreach ($fechas as $celda => $fecha) {
            $hoja->setCellValue($celda, Date::PHPToExcel(new \DateTime($fecha)));
        }

        $hoja->getStyle("A2:{$ultima}2")->applyFromArray([
            'font' => ['italic' => true, 'color' => ['rgb' => '9CA3AF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FAFAFA']],
        ]);
    }

    /**
     * Formato de las columnas para las filas que cargue el usuario.
     *
     * Se aplica a un rango amplio, no solo a la fila de ejemplo, para que al
     * escribir en la fila 50 el formato siga siendo el correcto.
     */
    private function formatearColumnasDeDatos($hoja): void
    {
        // Fechas
        foreach (['K', 'M', 'N', 'O'] as $col) {
            $hoja->getStyle("{$col}2:{$col}2000")
                ->getNumberFormat()->setFormatCode('dd/mm/yyyy');
        }

        // Montos
        $hoja->getStyle('T2:X2000')->getNumberFormat()->setFormatCode('#,##0.00');

        // Códigos de clase y subclase como texto, para preservar el cero
        // a la izquierda que Excel borra por su cuenta.
        foreach (['A', 'B'] as $col) {
            $hoja->getStyle("{$col}2:{$col}2000")
                ->getNumberFormat()->setFormatCode('@');
        }
    }

    private function hojaClases(Spreadsheet $libro): void
    {
        $hoja = $libro->createSheet();
        $hoja->setTitle('Clases');

        $hoja->fromArray(
            ['Clase', 'Nombre de la clase', 'Subclase', 'Nombre de la subclase', 'Vida útil fiscal'],
            null, 'A1'
        );

        $fila = 2;

        foreach (Clase::activas()->orderBy('codigo')->get() as $clase) {
            $subclases = Subclase::activas()->where('clase_id', $clase->id)->orderBy('codigo')->get();

            $vida = $clase->vida_util_fiscal_meses
                ? ($clase->vida_util_fiscal_meses / 12) . ' años'
                : 'no deprecia';

            if ($subclases->isEmpty()) {
                // Sin subclase no se puede importar: conviene que se vea.
                $hoja->fromArray(
                    [$clase->codigo, $clase->nombre, '', '⚠ sin subclases: no se puede importar', $vida],
                    null, "A{$fila}"
                );
                $hoja->getStyle("D{$fila}")->getFont()->getColor()->setARGB('FFB45309');
                $fila++;
                continue;
            }

            foreach ($subclases as $s) {
                $hoja->fromArray([$clase->codigo, $clase->nombre, $s->codigo, $s->nombre, $vida], null, "A{$fila}");
                $fila++;
            }
        }

        // Los códigos como texto, igual que en la hoja de carga.
        $hoja->getStyle("A2:A{$fila}")->getNumberFormat()->setFormatCode('@');
        $hoja->getStyle("C2:C{$fila}")->getNumberFormat()->setFormatCode('@');

        $this->formatearReferencia($hoja, 'E');
    }

    private function hojaUbicaciones(Spreadsheet $libro): void
    {
        $hoja = $libro->createSheet();
        $hoja->setTitle('Ubicaciones');

        $hoja->fromArray(['Código', 'Ubicación', 'Ruta completa'], null, 'A1');

        $fila = 2;

        foreach (Ubicacion::activas()->orderBy('codigo')->get() as $u) {
            $hoja->fromArray([$u->codigo, $u->nombre, $u->ruta], null, "A{$fila}");
            $fila++;
        }

        $this->formatearReferencia($hoja, 'C');
    }

    private function formatearReferencia($hoja, string $ultimaColumna): void
    {
        $hoja->getStyle("A1:{$ultimaColumna}1")->applyFromArray([
            'font' => ['bold' => true],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E7EEF6']],
            'borders' => ['bottom' => ['borderStyle' => Border::BORDER_THIN]],
        ]);

        foreach (range('A', $ultimaColumna) as $col) {
            $hoja->getColumnDimension($col)->setAutoSize(true);
        }

        $hoja->freezePane('A2');
    }
}