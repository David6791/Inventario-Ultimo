<?php

namespace App\Reportes;

use Illuminate\Http\Request;
use InvalidArgumentException;

/** Resuelve el reporte a partir del tipo pedido en la ruta. */
class FabricaReportes
{
    private const TIPOS = [
        'existencias'  => ReporteExistencias::class,
        'valorizado'   => ReporteValorizado::class,
        'movimientos'  => ReporteMovimientos::class,
        'vencimientos' => ReporteVencimientos::class,
        'consumo-areas'        => ReporteConsumoAreas::class,
        'consumo-solicitantes' => ReporteConsumoSolicitantes::class,
        'consumo-productos'    => ReporteConsumoProductos::class,
    ];

    public static function crear(string $tipo, Request $request): Reporte
    {
        $clase = self::TIPOS[$tipo] ?? throw new InvalidArgumentException(
            "No existe un reporte de tipo '{$tipo}'."
        );

        return new $clase($request);
    }

    /** @return list<string> */
    public static function disponibles(): array
    {
        return array_keys(self::TIPOS);
    }
}
