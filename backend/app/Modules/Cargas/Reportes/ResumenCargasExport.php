<?php

namespace App\Modules\Cargas\Reportes;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithTitle;

/** Resumen de cargas en Excel: una sección por clasificación, con lotes y kg. */
class ResumenCargasExport implements FromArray, WithTitle, ShouldAutoSize
{
    public function __construct(private readonly ResumenCargas $r, private readonly string $institucion)
    {
    }

    public function title(): string { return 'Resumen de cargas'; }

    public function array(): array
    {
        $d = $this->r->datos;
        $filas = [[$this->institucion], ['Resumen de cargas recibidas · ' . $this->r->titulo()],
                  ['Lotes', $d['totales']['lotes'], 'Kg (peso que vale, húmedo)', $d['totales']['kg']], []];
        $seccion = function (string $titulo, array $items, array $cab, callable $fila) use (&$filas) {
            $filas[] = [$titulo];
            $filas[] = $cab;
            foreach ($items as $i) { $filas[] = $fila($i); }
            $filas[] = [];
        };
        $simple = fn ($i) => [$i['nombre'], $i['lotes'], $i['kg']];
        $seccion('Por acopio', $d['por_acopio'], ['Acopio', 'Lotes', 'Kg'], $simple);
        $seccion('Por tipo de carga (serie)', $d['por_tipo'], ['Tipo', 'Lotes', 'Kg'], fn ($i) => [$i['clave'] . ' · ' . $i['nombre'], $i['lotes'], $i['kg']]);
        $seccion('Por material', $d['por_material'], ['Material', 'Lotes', 'Kg'], $simple);
        $seccion('Compra y producción propia', $d['por_origen'], ['Origen', 'Lotes', 'Kg'], $simple);
        $seccion('Producción de minas propias', $d['produccion_propia'], ['Mina', 'Bocamina', 'Lotes', 'Kg'],
            fn ($i) => [$i['mina'], $i['bocamina'], $i['lotes'], $i['kg']]);
        $seccion('Por día', $d['por_dia'], ['Fecha', 'Lotes', 'Kg'], fn ($i) => [\Carbon\Carbon::parse($i['fecha'])->format('d/m/Y'), $i['lotes'], $i['kg']]);

        return $filas;
    }
}
