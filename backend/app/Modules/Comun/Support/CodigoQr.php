<?php

namespace App\Modules\Comun\Support;

use InvalidArgumentException;

/**
 * Codificador QR (ISO/IEC 18004) en modo byte, versiones 1 a 10, sin
 * dependencias, con salida SVG para dompdf y el navegador.
 *
 * Alcanza para lo que necesitamos: URLs de verificación de hasta ~150
 * caracteres. Por defecto usa nivel de corrección Q (recupera ~25 % de
 * daño), pensando en rótulos que se ensucian o se rompen junto a la carga.
 *
 * Verificado módulo por módulo contra la librería «qrcode» de Python
 * (misma versión, nivel y máscara) y leído con el decodificador de OpenCV.
 */
final class CodigoQr
{
    public const L = 'L';
    public const M = 'M';
    public const Q = 'Q';
    public const H = 'H';

    /**
     * Por versión (1..10) y nivel: [EC por bloque, bloques g1, datos g1, bloques g2, datos g2].
     */
    private const BLOQUES = [
        'L' => [1 => [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0], [26, 1, 108, 0, 0],
                [18, 2, 68, 0, 0], [20, 2, 78, 0, 0], [24, 2, 97, 0, 0], [30, 2, 116, 0, 0], [18, 2, 68, 2, 69]],
        'M' => [1 => [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
                [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]],
        'Q' => [1 => [13, 1, 13, 0, 0], [22, 1, 22, 0, 0], [18, 2, 17, 0, 0], [26, 2, 24, 0, 0], [18, 2, 15, 2, 16],
                [24, 4, 19, 0, 0], [18, 2, 14, 4, 15], [22, 4, 18, 2, 19], [20, 4, 16, 4, 17], [24, 6, 19, 2, 20]],
        'H' => [1 => [17, 1, 9, 0, 0], [28, 1, 16, 0, 0], [22, 2, 13, 0, 0], [16, 4, 9, 0, 0], [22, 2, 11, 2, 12],
                [28, 4, 15, 0, 0], [26, 4, 13, 1, 14], [26, 4, 14, 2, 15], [24, 4, 12, 4, 13], [28, 6, 15, 2, 16]],
    ];

    private const ALINEACION = [1 => [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
                                [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

    private const BITS_NIVEL = ['L' => 1, 'M' => 0, 'Q' => 3, 'H' => 2];

    /** @var array<int, array<int, bool>> */
    private array $modulos = [];

    /** @var array<int, array<int, bool>> */
    private array $funcion = [];

    private int $tam;

    private function __construct(private readonly int $version, private readonly string $nivel)
    {
        $this->tam = $version * 4 + 17;
        $fila = array_fill(0, $this->tam, false);
        $this->modulos = array_fill(0, $this->tam, $fila);
        $this->funcion = array_fill(0, $this->tam, $fila);
    }

    /**
     * Matriz del QR: filas de booleanos (true = módulo oscuro), sin zona de silencio.
     *
     * @return array<int, array<int, bool>>
     */
    public static function matriz(string $texto, string $nivel = self::Q, ?int $mascara = null): array
    {
        if (! isset(self::BLOQUES[$nivel])) {
            throw new InvalidArgumentException("Nivel de corrección desconocido: {$nivel}");
        }
        $bytes = array_values(unpack('C*', $texto) ?: []);
        $version = self::versionPara(count($bytes), $nivel);

        $qr = new self($version, $nivel);
        $qr->dibujarPatrones();
        $qr->colocarDatos($qr->conCorreccion($qr->codewords($bytes)));

        if ($mascara === null) {
            // Se prueba cada máscara y se queda la de menor penalidad.
            $mejor = null;
            for ($m = 0; $m < 8; $m++) {
                $qr->aplicarMascara($m);
                $qr->dibujarFormato($m);
                $p = $qr->penalidad();
                if ($mejor === null || $p < $mejor[1]) {
                    $mejor = [$m, $p];
                }
                $qr->aplicarMascara($m);   // XOR: se deshace
            }
            $mascara = $mejor[0];
        }
        $qr->aplicarMascara($mascara);
        $qr->dibujarFormato($mascara);

        return $qr->modulos;
    }

    /** SVG cuadrado con zona de silencio de 4 módulos. */
    public static function svg(string $texto, string $nivel = self::Q, int $modulo = 4): string
    {
        $m = self::matriz($texto, $nivel);
        $n = count($m);
        $lado = ($n + 8) * $modulo;
        $d = '';
        foreach ($m as $y => $fila) {
            foreach ($fila as $x => $oscuro) {
                if ($oscuro) {
                    $d .= 'M' . (($x + 4) * $modulo) . ',' . (($y + 4) * $modulo) . "h{$modulo}v{$modulo}h-{$modulo}z";
                }
            }
        }

        return '<svg xmlns="http://www.w3.org/2000/svg" width="' . $lado . '" height="' . $lado . '" viewBox="0 0 ' . $lado . ' ' . $lado
            . '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="' . $d . '"/></svg>';
    }

    public static function dataUri(string $texto, string $nivel = self::Q): string
    {
        return 'data:image/svg+xml;base64,' . base64_encode(self::svg($texto, $nivel));
    }

    // ------------------------------------------------------------------ datos

    private static function capacidad(int $version, string $nivel): int
    {
        [, $b1, $d1, $b2, $d2] = self::BLOQUES[$nivel][$version];

        return $b1 * $d1 + $b2 * $d2;
    }

    private static function versionPara(int $largo, string $nivel): int
    {
        for ($v = 1; $v <= 10; $v++) {
            $bits = 4 + ($v <= 9 ? 8 : 16) + 8 * $largo;
            if ($bits <= self::capacidad($v, $nivel) * 8) {
                return $v;
            }
        }
        throw new InvalidArgumentException("Texto demasiado largo para un QR de versión 10 nivel {$nivel} ({$largo} bytes).");
    }

    /** @return int[] codewords de datos con terminador y relleno */
    private function codewords(array $bytes): array
    {
        $bits = [];
        $poner = function (int $valor, int $n) use (&$bits): void {
            for ($i = $n - 1; $i >= 0; $i--) {
                $bits[] = ($valor >> $i) & 1;
            }
        };
        $poner(0b0100, 4);
        $poner(count($bytes), $this->version <= 9 ? 8 : 16);
        foreach ($bytes as $b) {
            $poner($b, 8);
        }
        $cap = self::capacidad($this->version, $this->nivel) * 8;
        $poner(0, min(4, $cap - count($bits)));
        while (count($bits) % 8) {
            $bits[] = 0;
        }
        $cw = [];
        foreach (array_chunk($bits, 8) as $byte) {
            $cw[] = (int) bindec(implode('', $byte));
        }
        for ($pad = 0; count($cw) < $cap / 8; $pad ^= 1) {
            $cw[] = $pad ? 0x11 : 0xEC;
        }

        return $cw;
    }

    /** Divide en bloques, agrega Reed-Solomon a cada uno y los intercala. */
    private function conCorreccion(array $datos): array
    {
        [$ec, $b1, $d1, $b2, $d2] = self::BLOQUES[$this->nivel][$this->version];
        $bloques = [];
        $pos = 0;
        foreach ([[$b1, $d1], [$b2, $d2]] as [$cantidad, $largo]) {
            for ($i = 0; $i < $cantidad; $i++) {
                $bloques[] = array_slice($datos, $pos, $largo);
                $pos += $largo;
            }
        }
        $generador = self::generador($ec);
        $correccion = array_map(fn ($b) => self::restoRs($b, $generador), $bloques);

        $salida = [];
        $max = max($d1, $d2);
        for ($i = 0; $i < $max; $i++) {
            foreach ($bloques as $b) {
                if (isset($b[$i])) {
                    $salida[] = $b[$i];
                }
            }
        }
        for ($i = 0; $i < $ec; $i++) {
            foreach ($correccion as $c) {
                $salida[] = $c[$i];
            }
        }

        return $salida;
    }

    private static function multiplicar(int $x, int $y): int
    {
        $z = 0;
        for ($i = 7; $i >= 0; $i--) {
            $z = ($z << 1) ^ (($z >> 7) * 0x11D);
            $z ^= (($y >> $i) & 1) * $x;
        }

        return $z & 0xFF;
    }

    /** Coeficientes del polinomio generador de grado $grado (sin el término principal). */
    private static function generador(int $grado): array
    {
        $r = array_fill(0, $grado, 0);
        $r[$grado - 1] = 1;
        $raiz = 1;
        for ($i = 0; $i < $grado; $i++) {
            for ($j = 0; $j < $grado; $j++) {
                $r[$j] = self::multiplicar($r[$j], $raiz);
                if ($j + 1 < $grado) {
                    $r[$j] ^= $r[$j + 1];
                }
            }
            $raiz = self::multiplicar($raiz, 0x02);
        }

        return $r;
    }

    private static function restoRs(array $datos, array $generador): array
    {
        $r = array_fill(0, count($generador), 0);
        foreach ($datos as $b) {
            $factor = $b ^ array_shift($r);
            $r[] = 0;
            foreach ($generador as $i => $coef) {
                $r[$i] ^= self::multiplicar($coef, $factor);
            }
        }

        return $r;
    }

    // ---------------------------------------------------------------- matriz

    private function poner(int $x, int $y, bool $oscuro): void
    {
        $this->modulos[$y][$x] = $oscuro;
        $this->funcion[$y][$x] = true;
    }

    private function dibujarPatrones(): void
    {
        for ($i = 0; $i < $this->tam; $i++) {
            $this->poner(6, $i, $i % 2 === 0);
            $this->poner($i, 6, $i % 2 === 0);
        }
        foreach ([[3, 3], [$this->tam - 4, 3], [3, $this->tam - 4]] as [$cx, $cy]) {
            for ($dy = -4; $dy <= 4; $dy++) {
                for ($dx = -4; $dx <= 4; $dx++) {
                    $x = $cx + $dx;
                    $y = $cy + $dy;
                    if ($x >= 0 && $x < $this->tam && $y >= 0 && $y < $this->tam) {
                        $dist = max(abs($dx), abs($dy));
                        $this->poner($x, $y, $dist !== 2 && $dist !== 4);
                    }
                }
            }
        }
        $pos = self::ALINEACION[$this->version];
        $n = count($pos);
        for ($i = 0; $i < $n; $i++) {
            for ($j = 0; $j < $n; $j++) {
                if (($i === 0 && $j === 0) || ($i === 0 && $j === $n - 1) || ($i === $n - 1 && $j === 0)) {
                    continue;
                }
                for ($dy = -2; $dy <= 2; $dy++) {
                    for ($dx = -2; $dx <= 2; $dx++) {
                        $this->poner($pos[$i] + $dx, $pos[$j] + $dy, max(abs($dx), abs($dy)) !== 1);
                    }
                }
            }
        }
        $this->dibujarFormato(0);   // reserva el área; se reescribe con la máscara elegida
        if ($this->version >= 7) {
            $rem = $this->version;
            for ($i = 0; $i < 12; $i++) {
                $rem = ($rem << 1) ^ (($rem >> 11) * 0x1F25);
            }
            $bits = ($this->version << 12) | $rem;
            for ($i = 0; $i < 18; $i++) {
                $bit = (($bits >> $i) & 1) === 1;
                $a = $this->tam - 11 + $i % 3;
                $b = intdiv($i, 3);
                $this->poner($a, $b, $bit);
                $this->poner($b, $a, $bit);
            }
        }
    }

    private function dibujarFormato(int $mascara): void
    {
        $datos = (self::BITS_NIVEL[$this->nivel] << 3) | $mascara;
        $rem = $datos;
        for ($i = 0; $i < 10; $i++) {
            $rem = ($rem << 1) ^ (($rem >> 9) * 0x537);
        }
        $bits = (($datos << 10) | $rem) ^ 0x5412;
        $bit = fn (int $i) => (($bits >> $i) & 1) === 1;

        for ($i = 0; $i <= 5; $i++) {
            $this->poner(8, $i, $bit($i));
        }
        $this->poner(8, 7, $bit(6));
        $this->poner(8, 8, $bit(7));
        $this->poner(7, 8, $bit(8));
        for ($i = 9; $i < 15; $i++) {
            $this->poner(14 - $i, 8, $bit($i));
        }
        for ($i = 0; $i < 8; $i++) {
            $this->poner($this->tam - 1 - $i, 8, $bit($i));
        }
        for ($i = 8; $i < 15; $i++) {
            $this->poner(8, $this->tam - 15 + $i, $bit($i));
        }
        $this->poner(8, $this->tam - 8, true);   // módulo oscuro fijo
    }

    private function colocarDatos(array $codewords): void
    {
        $total = count($codewords) * 8;
        $i = 0;
        for ($derecha = $this->tam - 1; $derecha >= 1; $derecha -= 2) {
            if ($derecha === 6) {
                $derecha = 5;
            }
            for ($v = 0; $v < $this->tam; $v++) {
                for ($j = 0; $j < 2; $j++) {
                    $x = $derecha - $j;
                    $subiendo = (($derecha + 1) & 2) === 0;
                    $y = $subiendo ? $this->tam - 1 - $v : $v;
                    if (! $this->funcion[$y][$x] && $i < $total) {
                        $this->modulos[$y][$x] = (($codewords[$i >> 3] >> (7 - ($i & 7))) & 1) === 1;
                        $i++;
                    }
                }
            }
        }
    }

    private function aplicarMascara(int $m): void
    {
        for ($y = 0; $y < $this->tam; $y++) {
            for ($x = 0; $x < $this->tam; $x++) {
                if ($this->funcion[$y][$x]) {
                    continue;
                }
                $invertir = match ($m) {
                    0 => ($x + $y) % 2 === 0,
                    1 => $y % 2 === 0,
                    2 => $x % 3 === 0,
                    3 => ($x + $y) % 3 === 0,
                    4 => (intdiv($x, 3) + intdiv($y, 2)) % 2 === 0,
                    5 => ($x * $y) % 2 + ($x * $y) % 3 === 0,
                    6 => (($x * $y) % 2 + ($x * $y) % 3) % 2 === 0,
                    7 => (($x + $y) % 2 + ($x * $y) % 3) % 2 === 0,
                };
                if ($invertir) {
                    $this->modulos[$y][$x] = ! $this->modulos[$y][$x];
                }
            }
        }
    }

    /** Penalidad de la norma (reglas 1 a 4) para elegir la máscara. */
    private function penalidad(): int
    {
        $p = 0;
        $n = $this->tam;
        $lineas = [];
        for ($i = 0; $i < $n; $i++) {
            $fila = '';
            $col = '';
            for ($j = 0; $j < $n; $j++) {
                $fila .= $this->modulos[$i][$j] ? '1' : '0';
                $col .= $this->modulos[$j][$i] ? '1' : '0';
            }
            $lineas[] = $fila;
            $lineas[] = $col;
        }
        foreach ($lineas as $l) {
            preg_match_all('/0{5,}|1{5,}/', $l, $r);
            foreach ($r[0] as $tramo) {
                $p += 3 + strlen($tramo) - 5;
            }
            $p += 40 * (substr_count($l, '10111010000') + substr_count($l, '00001011101'));
        }
        $oscuros = 0;
        for ($y = 0; $y < $n; $y++) {
            for ($x = 0; $x < $n; $x++) {
                $c = $this->modulos[$y][$x];
                $oscuros += $c ? 1 : 0;
                if ($x < $n - 1 && $y < $n - 1 && $c === $this->modulos[$y][$x + 1]
                    && $c === $this->modulos[$y + 1][$x] && $c === $this->modulos[$y + 1][$x + 1]) {
                    $p += 3;
                }
            }
        }
        $total = $n * $n;
        $p += intdiv(abs($oscuros * 20 - $total * 10) + $total - 1, $total) * 10 - 10;

        return $p;
    }
}
