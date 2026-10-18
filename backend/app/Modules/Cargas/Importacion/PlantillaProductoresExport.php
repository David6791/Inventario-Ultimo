<?php

namespace App\Modules\Cargas\Importacion;

use App\Modules\Cargas\Models\Cooperativa;
use App\Modules\Cargas\Models\Productor;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Plantilla para cargar productores: la hoja que se llena, las instrucciones
 * y la lista de cooperativas ya registradas (para escribirlas igual).
 */
class PlantillaProductoresExport implements WithMultipleSheets
{
    use Exportable;

    public function sheets(): array
    {
        return [new HojaProductores, new HojaInstruccionesProductores, new HojaCooperativas];
    }
}

/** Encabezado oscuro común a las tres hojas. */
trait EncabezadoPlantilla
{
    public function styles(Worksheet $hoja): array
    {
        return [1 => [
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '16323F']],
        ]];
    }
}

class HojaProductores implements FromArray, WithTitle, WithStyles, WithColumnWidths
{
    use EncabezadoPlantilla;

    public const COLUMNAS = ['Tipo', 'Nombre', 'CI', 'NIT', 'NIM', 'Teléfono', 'Domicilio', 'Cooperativa'];

    public function array(): array
    {
        return [self::COLUMNAS];
    }

    public function title(): string
    {
        return 'Productores';
    }

    public function columnWidths(): array
    {
        return ['A' => 18, 'B' => 38, 'C' => 14, 'D' => 14, 'E' => 16, 'F' => 14, 'G' => 32, 'H' => 34];
    }
}

class HojaInstruccionesProductores implements FromArray, WithTitle, WithStyles, WithColumnWidths
{
    use EncabezadoPlantilla;

    public function array(): array
    {
        return [
            ['Columna', 'Cómo llenarla'],
            ['Tipo', 'Uno de: ' . implode(', ', Productor::TIPOS) . '. Vacío: COOPERATIVISTA si trae cooperativa, PARTICULAR si no.'],
            ['Nombre', 'Obligatorio. Nombre completo o razón social.'],
            ['CI / NIT', 'Al menos uno de los dos. Si ya existe un productor con ese CI o NIT, la fila lo ACTUALIZA.'],
            ['NIM', 'Opcional. No puede repetirse entre productores.'],
            ['Cooperativa', 'Obligatoria para cooperativistas. Si no existe, se crea. Use los nombres de la hoja "Cooperativas" para no duplicarlas.'],
            ['', ''],
            ['Importante', 'Si una sola fila tiene un error, no se importa nada. Primero se revisa el archivo y se muestra qué pasará.'],
        ];
    }

    public function title(): string
    {
        return 'Instrucciones';
    }

    public function columnWidths(): array
    {
        return ['A' => 16, 'B' => 110];
    }
}

class HojaCooperativas implements FromArray, WithTitle, WithStyles, WithColumnWidths
{
    use EncabezadoPlantilla;

    public function array(): array
    {
        return [
            ['Cooperativas registradas'],
            ...Cooperativa::activas()->orderBy('nombre')->pluck('nombre')->map(fn ($n) => [$n])->all(),
        ];
    }

    public function title(): string
    {
        return 'Cooperativas';
    }

    public function columnWidths(): array
    {
        return ['A' => 50];
    }
}
