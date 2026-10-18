<?php

namespace App\Modules\Comun\Support;

use InvalidArgumentException;

/**
 * Monto en letras para comprobantes y recibos, al estilo de los documentos
 * bolivianos: «UN MIL DOSCIENTOS CINCUENTA 50/100 BOLIVIANOS».
 *
 * Los centavos van en fracción y se redondean a dos decimales. Admite hasta
 * 999.999.999.999,99.
 */
final class MontoEnLetras
{
    private const UNIDADES = [
        '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
        'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE',
        'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS',
        'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
    ];

    private const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];

    private const CENTENAS = [
        '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
        'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
    ];

    public const MONEDAS = [
        'BOB' => 'BOLIVIANOS',
        'USD' => 'DÓLARES ESTADOUNIDENSES',
    ];

    public static function convertir(string|float|int $monto, string $moneda = 'BOB'): string
    {
        $centavosTotales = (int) round(((float) $monto) * 100);
        if ($centavosTotales < 0) {
            throw new InvalidArgumentException('El monto no puede ser negativo.');
        }

        $entero = intdiv($centavosTotales, 100);
        $centavos = $centavosTotales % 100;

        if ($entero > 999_999_999_999) {
            throw new InvalidArgumentException('Monto demasiado grande para escribirlo en letras.');
        }

        $texto = $entero === 0 ? 'CERO' : self::entero($entero);

        return trim(sprintf('%s %02d/100 %s', $texto, $centavos, self::MONEDAS[$moneda] ?? $moneda));
    }

    /** 1 a 999.999.999.999 */
    private static function entero(int $n): string
    {
        $partes = [];

        $millones = intdiv($n, 1_000_000);
        $resto = $n % 1_000_000;

        if ($millones > 0) {
            $partes[] = $millones === 1 ? 'UN MILLÓN' : self::hastaMillon($millones) . ' MILLONES';
        }
        if ($resto > 0) {
            $partes[] = self::hastaMillon($resto);
        }

        return implode(' ', $partes);
    }

    /** 1 a 999.999 */
    private static function hastaMillon(int $n): string
    {
        $miles = intdiv($n, 1000);
        $resto = $n % 1000;
        $partes = [];

        if ($miles > 0) {
            // En los documentos bolivianos se escribe «UN MIL».
            $partes[] = ($miles === 1 ? 'UN' : self::hastaMil($miles)) . ' MIL';
        }
        if ($resto > 0) {
            $partes[] = self::hastaMil($resto);
        }

        return implode(' ', $partes);
    }

    /** 1 a 999 */
    private static function hastaMil(int $n): string
    {
        if ($n === 100) {
            return 'CIEN';
        }

        $c = intdiv($n, 100);
        $resto = $n % 100;
        $partes = [];

        if ($c > 0) {
            $partes[] = self::CENTENAS[$c];
        }
        if ($resto > 0) {
            if ($resto < 30) {
                $partes[] = self::UNIDADES[$resto];
            } else {
                $d = intdiv($resto, 10);
                $u = $resto % 10;
                $partes[] = self::DECENAS[$d] . ($u > 0 ? ' Y ' . self::UNIDADES[$u] : '');
            }
        }

        return implode(' ', $partes);
    }
}
