<?php

namespace App\Exports;

use App\Models\Categoria;
use App\Models\UnidadMedida;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use Maatwebsite\Excel\Concerns\FromArray;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Plantilla para cargar productos desde Excel.
 *
 * Cuatro hojas: los datos a llenar, las instrucciones, y las listas de
 * categorías y unidades válidas.
 *
 * Las listas van EN el archivo a propósito. Si el usuario tiene que adivinar
 * los códigos o buscarlos en otra pantalla, los va a inventar — y cada código
 * inventado es una fila rechazada.
 */
class PlantillaProductosExport implements WithMultipleSheets, WithStyles, WithTitle
{
    use Exportable;

    public function sheets(): array
    {
        return [
            new HojaProductos,
            new HojaInstrucciones,
            new HojaCategorias,
            new HojaUnidades,
        ];
    }
    public function title(): string
    {
        return 'Productos';
    }
    public function styles(Worksheet $hoja)
    {
        $ultimaFila = $hoja->getHighestDataRow();

        $hoja->getStyle("A1:K{$ultimaFila}")
            ->getBorders()
            ->getAllBorders()
            ->setBorderStyle(Border::BORDER_THIN);

        return [
            1 => ['font' => ['bold' => true]],
        ];
    }
}

/** La hoja que el usuario llena. */
class HojaProductos implements FromArray, WithTitle, WithStyles, WithColumnWidths, WithEvents
{
    public const COLUMNAS = [
        'codigo'                 => 'Código',
        'nombre'                 => 'Nombre',
        'descripcion'            => 'Descripción',
        'categoria'              => 'Categoría',
        'unidad'                 => 'Unidad',
        'stock_minimo'           => 'Stock mínimo',
        'stock_maximo'           => 'Stock máximo',
        'partida_presupuestaria' => 'Partida',
        'codigo_barras'          => 'Código de barras',
        'controla_lote'          => 'Controla lote',
        'controla_vencimiento'   => 'Controla vencimiento',
    ];

    public function array(): array
    {
        return [
            array_values(self::COLUMNAS),

            // Dos filas de ejemplo. Se borran antes de cargar: la importación
            // avisa si quedaron, porque sus códigos no serían reales.
            ['ESCR-0001', 'Papel bond tamaño carta 75 g', 'Resma de 500 hojas',
             'ESCR', 'RES', 10, 100, '34200', '', 'NO', 'NO'],
            ['', 'Guantes de nitrilo talla M', '', 'SEGU', 'CJA', 5, '', '34800', '', 'NO', 'SI'],
        ];
    }

    public function title(): string
    {
        return 'Productos';
    }

    public function columnWidths(): array
    {
        return [
            'A' => 16, 'B' => 42, 'C' => 32, 'D' => 12, 'E' => 10,
            'F' => 14, 'G' => 14, 'H' => 12, 'I' => 18, 'J' => 14, 'K' => 20,
        ];
    }

    public function styles(Worksheet $hoja): array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType'   => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '16323F'],
                ],
                'borders' => ['bottom' => ['borderStyle' => Border::BORDER_THIN]],
            ],
            // Las filas de ejemplo en gris: se distinguen de lo que se carga.
            2 => ['font' => ['italic' => true, 'color' => ['rgb' => '999999']]],
            3 => ['font' => ['italic' => true, 'color' => ['rgb' => '999999']]],
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $evento) {
                $hoja = $evento->sheet->getDelegate();

                $hoja->freezePane('A2');

                /*
                | Listas desplegables en las columnas de categoría y unidad.
                |
                | Es lo que más reduce los errores: en vez de escribir el código
                | a mano, se elige de una lista. Apuntan a las hojas de
                | referencia, así que siempre reflejan lo que hay en el sistema.
                */
                $this->listaDesplegable($hoja, 'D', "Categorias!\$A\$2:\$A\$200",
                    'Elija una categoría de la lista');
                $this->listaDesplegable($hoja, 'E', "Unidades!\$A\$2:\$A\$200",
                    'Elija una unidad de la lista');

                foreach (['J', 'K'] as $columna) {
                    $this->listaLiteral($hoja, $columna, '"SI,NO"');
                }

                // El código de barras suele empezar con ceros: sin esto Excel
                // los borra al interpretarlo como número.
                $hoja->getStyle('A2:A1000')->getNumberFormat()->setFormatCode('@');
                $hoja->getStyle('I2:I1000')->getNumberFormat()->setFormatCode('@');
                $hoja->getStyle('H2:H1000')->getNumberFormat()->setFormatCode('@');
            },
        ];
    }

    private function listaDesplegable(Worksheet $hoja, string $columna, string $rango, string $mensaje): void
    {
        for ($fila = 2; $fila <= 1000; $fila++) {
            $validacion = $hoja->getCell("{$columna}{$fila}")->getDataValidation();
            $validacion->setType(\PhpOffice\PhpSpreadsheet\Cell\DataValidation::TYPE_LIST);
            $validacion->setErrorStyle(\PhpOffice\PhpSpreadsheet\Cell\DataValidation::STYLE_INFORMATION);
            $validacion->setAllowBlank(false);
            $validacion->setShowDropDown(true);
            $validacion->setShowErrorMessage(true);
            $validacion->setErrorTitle('Valor no válido');
            $validacion->setError($mensaje);
            $validacion->setFormula1($rango);
        }
    }

    private function listaLiteral(Worksheet $hoja, string $columna, string $valores): void
    {
        for ($fila = 2; $fila <= 1000; $fila++) {
            $validacion = $hoja->getCell("{$columna}{$fila}")->getDataValidation();
            $validacion->setType(\PhpOffice\PhpSpreadsheet\Cell\DataValidation::TYPE_LIST);
            $validacion->setAllowBlank(true);
            $validacion->setShowDropDown(true);
            $validacion->setFormula1($valores);
        }
    }
}

class HojaInstrucciones implements FromArray, WithTitle, WithStyles, WithColumnWidths
{
    public function array(): array
    {
        return [
            ['CÓMO LLENAR ESTA PLANTILLA'],
            [''],
            ['1. Borre las dos filas de ejemplo (están en gris) antes de cargar.'],
            ['2. Llene una fila por producto en la hoja "Productos".'],
            ['3. No cambie los títulos de las columnas ni el orden.'],
            ['4. Guarde el archivo y súbalo desde Catálogos → Productos → Importar.'],
            [''],
            ['QUÉ SIGNIFICA CADA COLUMNA'],
            [''],
            ['Columna', 'Obligatorio', 'Detalle'],
            ['Código', 'No', 'Si lo deja vacío, el sistema lo genera desde la categoría (ESCR-0001). Si lo escribe y ya existe, ese producto se ACTUALIZA.'],
            ['Nombre', 'Sí', 'Hasta 200 caracteres. Debe ser único.'],
            ['Descripción', 'No', 'Detalle adicional, hasta 500 caracteres.'],
            ['Categoría', 'Sí', 'El CÓDIGO de la categoría, no el nombre. Vea la hoja "Categorias".'],
            ['Unidad', 'Sí', 'El CÓDIGO de la unidad de medida. Vea la hoja "Unidades".'],
            ['Stock mínimo', 'No', 'Cantidad bajo la cual el sistema avisa. Deje vacío o 0 si no aplica.'],
            ['Stock máximo', 'No', 'Solo si maneja un tope. Debe ser mayor que el mínimo.'],
            ['Partida', 'No', 'Partida presupuestaria del clasificador de gastos.'],
            ['Código de barras', 'No', 'Si lo tiene registrado.'],
            ['Controla lote', 'No', 'SI o NO. Marque SI en productos que se manejan por lote.'],
            ['Controla vencimiento', 'No', 'SI o NO. Marque SI en productos con fecha de caducidad.'],
            [''],
            ['ANTES DE CARGAR'],
            [''],
            ['El sistema revisa TODO el archivo antes de importar nada.'],
            ['Si alguna fila tiene un error, no se carga ninguna y se le indica qué corregir.'],
            ['Esto es a propósito: una carga a medias deja el catálogo en un estado difícil de revisar.'],
            [''],
            ['Si un código ya existe, ese producto se actualiza con los datos nuevos.'],
            ['Puede usar esa misma función para corregir datos en masa.'],
        ];
    }

    public function title(): string
    {
        return 'Instrucciones';
    }

    public function columnWidths(): array
    {
        return ['A' => 24, 'B' => 14, 'C' => 90];
    }

    public function styles(Worksheet $hoja): array
    {
        return [
            1  => ['font' => ['bold' => true, 'size' => 14]],
            8  => ['font' => ['bold' => true, 'size' => 12]],
            10 => ['font' => ['bold' => true]],
            23 => ['font' => ['bold' => true, 'size' => 12]],
        ];
    }
}

class HojaCategorias implements FromArray, WithTitle, WithStyles, WithColumnWidths
{
    public function array(): array
    {
        $filas = [['Código', 'Nombre']];

        foreach (Categoria::orderBy('codigo')->get() as $categoria) {
            $filas[] = [$categoria->codigo, $categoria->nombre];
        }

        return $filas;
    }

    public function title(): string
    {
        return 'Categorias';
    }

    public function columnWidths(): array
    {
        return ['A' => 14, 'B' => 44];
    }

    public function styles(Worksheet $hoja): array
    {
        return [1 => ['font' => ['bold' => true]]];
    }
}

class HojaUnidades implements FromArray, WithTitle, WithStyles, WithColumnWidths
{
    public function array(): array
    {
        $filas = [['Código', 'Nombre', 'Admite decimales']];

        foreach (UnidadMedida::orderBy('codigo')->get() as $unidad) {
            $filas[] = [
                $unidad->codigo,
                $unidad->nombre,
                $unidad->permite_decimales ? 'Sí' : 'No',
            ];
        }

        return $filas;
    }

    public function title(): string
    {
        return 'Unidades';
    }

    public function columnWidths(): array
    {
        return ['A' => 14, 'B' => 30, 'C' => 18];
    }

    public function styles(Worksheet $hoja): array
    {
        return [1 => ['font' => ['bold' => true]]];
    }
}
