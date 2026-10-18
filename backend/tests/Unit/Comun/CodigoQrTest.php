<?php

namespace Tests\Unit\Comun;

use App\Modules\Comun\Support\CodigoQr;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class CodigoQrTest extends TestCase
{
    /** Matriz de referencia generada con la librería «qrcode» de Python (v2, nivel Q, máscara 3). */
    private const REFERENCIA = [
        '1111111001011111001111111', '1000001011010100101000001', '1011101010101000101011101',
        '1011101001010011001011101', '1011101001100010101011101', '1000001001110101101000001',
        '1111111010101010101111111', '0000000000000001100000000', '0111011000101101000000110',
        '1110000011011111001101001', '0110011010110100110111100', '1100100101111000111001110',
        '1111001100110011011101001', '0011010111011010110111010', '0101011000011111101011010',
        '1001010011100000101000011', '0011101000100011111111001', '0000000011110110100010000',
        '1111111000100011101010011', '1000001011000100100011000', '1011101001111110111110111',
        '1011101010100100111101001', '1011101010010010010111110', '1000001010001011111001100',
        '1111111000000010010001011',
    ];

    public function test_coincide_con_la_referencia_modulo_por_modulo(): void
    {
        $m = CodigoQr::matriz('MACGYCASUCHOS', CodigoQr::Q, 3);
        $filas = array_map(fn ($f) => implode('', array_map(fn ($b) => $b ? '1' : '0', $f)), $m);

        $this->assertSame(self::REFERENCIA, $filas);
    }

    public function test_elige_la_version_minima_y_dibuja_los_patrones_fijos(): void
    {
        $url = 'https://cargas.macgycasuchos.bo/l/' . str_repeat('0f', 16);
        $m = CodigoQr::matriz($url);
        $this->assertCount(41, $m);   // 66 bytes en nivel Q → versión 6 (41×41)

        // Buscadores en tres esquinas, módulo oscuro fijo y patrón de sincronismo.
        foreach ([[0, 0], [0, 34], [34, 0]] as [$y, $x]) {
            $this->assertTrue($m[$y][$x] && $m[$y + 6][$x + 6] && $m[$y + 3][$x + 3]);
            $this->assertFalse($m[$y + 1][$x + 1]);
        }
        $this->assertTrue($m[41 - 8][8]);
        for ($i = 8; $i < 33; $i++) {
            $this->assertSame($i % 2 === 0, $m[6][$i]);
        }
    }

    public function test_svg_y_limite_de_largo(): void
    {
        $svg = CodigoQr::svg('hola');
        $this->assertStringStartsWith('<svg', $svg);
        $this->assertStringContainsString('width="116"', $svg);   // (21 + 8) × 4

        $this->expectException(InvalidArgumentException::class);
        CodigoQr::matriz(str_repeat('x', 200));
    }
}
