<?php

namespace App\Modules\Comun\Support;

use InvalidArgumentException;

/**
 * Código de barras Code 128 (juego B) en SVG, para imprimirlo con dompdf en
 * boletas y etiquetas. Los lectores de la recepción leen Code 128, igual que
 * las etiquetas de activos (JsBarcode en el navegador).
 */
final class CodigoBarras
{
    /** Anchos barra/espacio de cada símbolo, 0 a 106 (106 = parada). */
    private const PATRONES = [
        '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
        '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
        '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
        '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
        '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
        '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
        '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
        '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
        '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
        '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
        '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
    ];

    private const INICIO_B = 104;
    private const PARADA = 106;

    /** Secuencia de anchos (barra, espacio, barra…) del texto, con inicio, verificación y parada. */
    public static function anchos(string $texto): array
    {
        if ($texto === '' || preg_match('/[^\x20-\x7E]/', $texto)) {
            throw new InvalidArgumentException('Code 128 B solo admite caracteres ASCII imprimibles.');
        }

        $simbolos = [self::INICIO_B];
        foreach (str_split($texto) as $c) {
            $simbolos[] = ord($c) - 32;
        }
        $suma = self::INICIO_B;
        foreach (array_slice($simbolos, 1) as $i => $s) {
            $suma += $s * ($i + 1);
        }
        $simbolos[] = $suma % 103;
        $simbolos[] = self::PARADA;

        $anchos = [];
        foreach ($simbolos as $s) {
            foreach (str_split(self::PATRONES[$s]) as $a) {
                $anchos[] = (int) $a;
            }
        }

        return $anchos;
    }

    /** SVG listo para <img src="data:image/svg+xml;base64,..."> con zona de silencio a los lados. */
    public static function svg(string $texto, float $modulo = 1.0, float $alto = 40): string
    {
        $silencio = 10;
        $x = $silencio * $modulo;
        $barras = '';
        foreach (self::anchos($texto) as $i => $ancho) {
            $w = $ancho * $modulo;
            if ($i % 2 === 0) {
                $barras .= sprintf('<rect x="%.2f" y="0" width="%.2f" height="%.2f"/>', $x, $w, $alto);
            }
            $x += $w;
        }
        $total = $x + $silencio * $modulo;

        return sprintf(
            '<svg xmlns="http://www.w3.org/2000/svg" width="%.2f" height="%.2f" viewBox="0 0 %.2f %.2f">'
            . '<rect width="100%%" height="100%%" fill="#fff"/><g fill="#000">%s</g></svg>',
            $total, $alto, $total, $alto, $barras
        );
    }

    public static function dataUri(string $texto, float $modulo = 1.0, float $alto = 40): string
    {
        return 'data:image/svg+xml;base64,' . base64_encode(self::svg($texto, $modulo, $alto));
    }
}
