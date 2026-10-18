<?php

namespace Tests\Unit\Comun;

use App\Modules\Comun\Support\MontoEnLetras;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class MontoEnLetrasTest extends TestCase
{
    public static function montos(): array
    {
        return [
            [0, 'CERO 00/100 BOLIVIANOS'],
            [1, 'UN 00/100 BOLIVIANOS'],
            [15.5, 'QUINCE 50/100 BOLIVIANOS'],
            [21, 'VEINTIÚN 00/100 BOLIVIANOS'],
            [80, 'OCHENTA 00/100 BOLIVIANOS'],
            [100, 'CIEN 00/100 BOLIVIANOS'],
            [101, 'CIENTO UN 00/100 BOLIVIANOS'],
            [345.99, 'TRESCIENTOS CUARENTA Y CINCO 99/100 BOLIVIANOS'],
            [1000, 'UN MIL 00/100 BOLIVIANOS'],
            [1250.5, 'UN MIL DOSCIENTOS CINCUENTA 50/100 BOLIVIANOS'],
            [21000, 'VEINTIÚN MIL 00/100 BOLIVIANOS'],
            [100000, 'CIEN MIL 00/100 BOLIVIANOS'],
            [1000000, 'UN MILLÓN 00/100 BOLIVIANOS'],
            [2500300.07, 'DOS MILLONES QUINIENTOS MIL TRESCIENTOS 07/100 BOLIVIANOS'],
            ['0.005', 'CERO 01/100 BOLIVIANOS'],
        ];
    }

    #[DataProvider('montos')]
    public function test_convierte_a_letras(float|int|string $monto, string $esperado): void
    {
        $this->assertSame($esperado, MontoEnLetras::convertir($monto));
    }

    public function test_dolares(): void
    {
        $this->assertSame('CINCUENTA 00/100 DÓLARES ESTADOUNIDENSES', MontoEnLetras::convertir(50, 'USD'));
    }
}
