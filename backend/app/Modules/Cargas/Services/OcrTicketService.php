<?php

namespace App\Modules\Cargas\Services;

use App\Modules\Cargas\Models\PlantillaBascula;
use GdImage;
use Illuminate\Support\Facades\Process;
use RuntimeException;

/**
 * Lee un ticket de báscula con Tesseract, recuadro por recuadro.
 *
 * La foto llega ya enderezada (el navegador la recorta por las cuatro esquinas
 * del ticket a la proporción de la plantilla), así que cada dato está siempre
 * en el mismo lugar: x, y, ancho y alto como fracciones del ticket.
 *
 * Por cada recuadro: se recorta con un margen, se pasa a gris, se suaviza si
 * el ticket es de impresora matricial (los puntos se unen), se agranda, se
 * binariza con Otsu y se lee como una sola línea. Si un dato no sale y la
 * plantilla le dio una etiqueta («BRUTO»), se busca esa etiqueta en el texto de
 * todo el ticket y se toma el número que la sigue en la misma línea.
 *
 * Nada de esto se guarda solo: la persona confirma o corrige lo leído.
 */
class OcrTicketService
{
    /** Ancho al que se normaliza el ticket antes de recortar. */
    private const ANCHO = 1400;

    /** Alto al que se lleva cada recorte (Tesseract lee mejor letras de ~40 px). */
    private const ALTO_RECORTE = 96;

    public function disponible(): bool
    {
        try {
            return Process::timeout(10)->run([config('services.tesseract.bin'), '--version'])->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * @param  string  $ruta   imagen del ticket enderezado
     * @param  array   $campos recuadros de la plantilla
     * @return array{campos: array<string, array>, coherente: ?bool, avisos: string[]}
     */
    public function leer(string $ruta, array $campos): array
    {
        $imagen = $this->cargar($ruta);
        $resultado = [];
        $avisos = [];
        $textoCompleto = null;

        $candidatos = [];
        try {
            foreach ($campos as $c) {
                $campo = $c['campo'];
                $tipo = PlantillaBascula::CAMPOS[$campo]['tipo'] ?? 'texto';
                if ($tipo === 'digitos' && ! empty($c['letras'])) {
                    $tipo = 'texto';            // tickets con letras («A-004512»)
                }

                // Los pesos (y la placa) se leen con varios suavizados y los dos umbrales;
                // luego se elige la combinación que cuadra. Los demás datos, con el umbral
                // global y, si no salen bien, con el local (sombras).
                $d = (int) ($c['desenfoque'] ?? 1);
                $varios = $tipo === 'numero' || $campo === 'placa';
                $variantes = $varios
                    ? array_values(array_unique([[$d, 'otsu'], [0, 'otsu'], [2, 'otsu'], [1, 'local']], SORT_REGULAR))
                    : array_values(array_unique([[$d, 'otsu'], [0, 'otsu'], [1, 'local']], SORT_REGULAR));
                $lecturas = [];
                foreach ($variantes as [$dv, $metodo]) {
                    $l = $this->leerRecuadro($imagen, [...$c, 'desenfoque' => $dv, 'umbral' => $metodo], $tipo);
                    if ($l['valor'] !== null) {
                        $lecturas[] = $l;
                        if (! $varios && $this->valido($campo, $l['valor'])) {
                            break;
                        }
                    }
                }

                if (! $lecturas && ! empty($c['etiqueta'])) {
                    $textoCompleto ??= $this->textoCompleto($imagen);
                    $porEtiqueta = $this->buscarPorEtiqueta($textoCompleto, $c['etiqueta'], $tipo, (int) ($c['decimales'] ?? 0));
                    if ($porEtiqueta) {
                        $lecturas[] = $porEtiqueta;
                    }
                }
                usort($lecturas, fn ($a, $b) => $b['confianza'] <=> $a['confianza']);
                // Primero las lecturas con la forma esperada (placa 1175PFT, fecha válida…).
                usort($lecturas, fn ($a, $b) => (int) $this->valido($campo, $b['valor']) <=> (int) $this->valido($campo, $a['valor']));
                $candidatos[$campo] = $lecturas;
                $resultado[$campo] = $lecturas[0] ?? ['texto' => '', 'valor' => null, 'confianza' => 0, 'metodo' => 'recuadro'];
            }
        } finally {
            imagedestroy($imagen);
        }

        $this->elegirCombinacion($candidatos, $resultado);
        $coherente = $this->revisarPesos($resultado, $avisos);
        $fecha = $this->fechaHora($resultado['fecha']['valor'] ?? null, $resultado['hora']['valor'] ?? null);

        return ['campos' => $resultado, 'coherente' => $coherente, 'avisos' => $avisos, 'fecha_ticket' => $fecha];
    }

    // -----------------------------------------------------------------------

    private function cargar(string $ruta): GdImage
    {
        $datos = @file_get_contents($ruta);
        $img = $datos !== false ? @imagecreatefromstring($datos) : false;
        if (! $img) {
            throw new RuntimeException('No se pudo abrir la imagen del ticket.');
        }
        $w = imagesx($img);
        if ($w !== self::ANCHO) {
            $escalada = imagescale($img, self::ANCHO, (int) round(imagesy($img) * self::ANCHO / $w), IMG_BICUBIC);
            imagedestroy($img);
            $img = $escalada;
        }

        return $img;
    }

    /**
     * La foto nunca queda enderezada al milímetro: el recuadro se recorta con
     * margen, se busca la línea de texto más cercana a su centro (perfil de
     * tinta por fila) y se ensancha hasta los espacios en blanco para no cortar
     * un dígito. Esa línea se lee sola con Tesseract.
     */
    private function leerRecuadro(GdImage $img, array $c, string $tipo): array
    {
        $W = imagesx($img);
        $H = imagesy($img);
        $mx = $c['w'] * 0.2;
        $my = $c['h'] * 0.7;
        $x = max(0, (int) floor(($c['x'] - $mx) * $W));
        $y = max(0, (int) floor(($c['y'] - $my) * $H));
        $w = min($W - $x, (int) ceil(($c['w'] + 2 * $mx) * $W));
        $h = min($H - $y, (int) ceil(($c['h'] + 2 * $my) * $H));
        $vacio = ['texto' => '', 'valor' => null, 'confianza' => 0, 'metodo' => 'recuadro'];
        if ($w < 4 || $h < 4) {
            return $vacio;
        }

        $recorte = imagecrop($img, ['x' => $x, 'y' => $y, 'width' => $w, 'height' => $h]);
        $escala = self::ALTO_RECORTE / max(1.0, $c['h'] * $H);       // el recuadro queda de ~96 px de alto
        [$bin, $borde] = $this->preparar($recorte, (int) ($c['desenfoque'] ?? 1), $escala, $c['umbral'] ?? 'otsu');
        imagedestroy($recorte);

        // Recuadro original dentro de la imagen binaria.
        $bx0 = (int) round((($c['x'] * $W) - $x) * $escala) + $borde;
        $bx1 = (int) round($bx0 + $c['w'] * $W * $escala);
        $by0 = (int) round((($c['y'] * $H) - $y) * $escala) + $borde;
        $by1 = (int) round($by0 + $c['h'] * $H * $escala);

        $this->quitarMarcos($bin, max(8, $by1 - $by0));
        $zona = $this->ubicarLinea($bin, $bx0, $bx1, $by0, $by1);
        if (! $zona) {
            imagedestroy($bin);

            return $vacio;
        }
        [$x0, $y0, $x1, $y1] = $zona;
        $linea = imagecreatetruecolor($x1 - $x0 + 40, $y1 - $y0 + 40);
        imagefill($linea, 0, 0, imagecolorallocate($linea, 255, 255, 255));
        imagecopy($linea, $bin, 20, 20, $x0, $y0, $x1 - $x0, $y1 - $y0);
        imagedestroy($bin);

        $lista = match ($tipo) {
            'numero'  => '0123456789.,',
            'nombre'  => null,      // con lista de caracteres Tesseract pega las palabras
            'fecha'   => '0123456789/-:.',
            'digitos' => '0123456789:',   // con «:» para reconocer el de «N.º: 2140» y quitarlo
            default   => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-/:.',
        };
        if ($dir = env('OCR_DEPURAR')) {            // carpeta para ver qué recibe Tesseract
            imagepng($linea, rtrim($dir, '/') . "/{$c['campo']}-d" . ($c['desenfoque'] ?? 1) . '-' . ($c['umbral'] ?? 'otsu') . '.png');
        }
        $palabras = $this->tesseract($linea, 7, $lista);
        imagedestroy($linea);
        if (! $palabras) {
            return $vacio;
        }

        $texto = trim(implode(' ', array_column($palabras, 'texto')), " .,:-/");
        $confianza = (int) round(max(0, array_sum(array_column($palabras, 'conf')) / count($palabras)));
        if ($tipo === 'digitos') {
            $texto = preg_replace('/^.*:\s*/u', '', $texto);        // «N. Orden: 458670» → «458670»
        } elseif ($tipo !== 'numero') {
            // La etiqueta impresa dentro del recuadro: «N: 004512», «Socio : QUISPE…»,
            // «Fecha : 2026-10-23». Solo si antes de «:» no hay números (08:18:23 queda).
            $texto = preg_replace('/^[^\d:]*:\s*/u', '', $texto);
        }
        $valor = match ($tipo) {
            'numero'  => $this->numero($texto, (int) ($c['decimales'] ?? 0)),
            'digitos' => preg_replace('/\D/', '', $texto) ?: null,
            'nombre'  => $this->nombre($texto),
            'fecha'   => trim(preg_replace('/[^\d\/\-:. ]/', '', $texto)) ?: null,
            default   => $this->limpiarTexto($texto) ?: null,
        };
        if ($c['campo'] === 'placa' && $valor !== null) {
            $valor = $this->placa($valor) ?? $valor;
        }

        return ['texto' => $texto, 'valor' => $valor, 'confianza' => $confianza, 'metodo' => 'recuadro'];
    }

    /**
     * Borra del recorte binario las líneas y los marcos impresos (las cajas
     * donde algunas balanzas imprimen el peso, subrayados, bordes de tabla):
     * son manchas mucho más anchas o altas que un número y casi vacías por
     * dentro. Si quedan, Tesseract las lee como 1 o como otros dígitos.
     */
    private function quitarMarcos(GdImage $bin, int $alto): void
    {
        $W = imagesx($bin);
        $H = imagesy($bin);
        $tinta = [];
        for ($y = 0; $y < $H; $y++) {
            for ($x = 0; $x < $W; $x++) {
                $tinta[$y * $W + $x] = (imagecolorat($bin, $x, $y) & 0xFF) < 128;
            }
        }
        $blanco = imagecolorallocate($bin, 255, 255, 255);
        $borrar = function (array $puntos) use (&$tinta, $bin, $W, $blanco): void {
            foreach ($puntos as $k) {
                $tinta[$k] = false;
                imagesetpixel($bin, $k % $W, intdiv($k, $W), $blanco);
            }
        };

        // 1) Rayas horizontales: una corrida de tinta más larga que el alto del dato
        //    no es un número (los dígitos están separados). Se borran solo esos
        //    puntos, así un dígito que toca el borde de la caja queda entero.
        $puntos = [];
        $largo = (int) ceil($alto);
        for ($y = 0; $y < $H; $y++) {
            $x = 0;
            while ($x < $W) {
                if (! $tinta[$y * $W + $x]) { $x++; continue; }
                $ini = $x;
                while ($x < $W && $tinta[$y * $W + $x]) { $x++; }
                if ($x - $ini >= $largo) {
                    for ($k = $ini; $k < $x; $k++) { $puntos[] = $y * $W + $k; }
                }
            }
        }
        $borrar($puntos);

        // 2) Manchas y alto típico de los caracteres.
        $manchas = $this->manchas($tinta, $W, $H);
        // Alto de los números: la mancha más alta que no sea una raya fina (los
        // lados de una caja son finos; los dígitos, aunque estén pegados entre sí,
        // no). Si hay duda se queda corto de borrar, nunca de más.
        $altoLetra = 0;
        foreach ($manchas as $m) {
            if ($m['w'] > 0.2 * $m['h'] && $m['h'] <= 1.6 * $alto && $m['h'] >= 0.3 * $alto) {
                $altoLetra = max($altoLetra, $m['h']);
            }
        }
        if ($altoLetra === 0) {
            $altoLetra = $alto;
        }

        // 3) Rayas verticales: los lados de la caja son más altos que los números
        //    que encierran. Otra vez solo los puntos de la raya.
        $puntos = [];
        $largo = (int) ceil(1.12 * $altoLetra);
        for ($x = 0; $x < $W; $x++) {
            $y = 0;
            while ($y < $H) {
                if (! $tinta[$y * $W + $x]) { $y++; continue; }
                $ini = $y;
                while ($y < $H && $tinta[$y * $W + $x]) { $y++; }
                if ($y - $ini >= $largo) {
                    for ($k = $ini; $k < $y; $k++) { $puntos[] = $k * $W + $x; }
                }
            }
        }
        $borrar($puntos);

        // 4) Restos de marcos: manchas que cruzan todo el recorte, grandes y casi
        //    vacías, rayas cortas o restos más finos que un trazo.
        foreach ($this->manchas($tinta, $W, $H) as $m) {
            $relleno = count($m['puntos']) / ($m['w'] * $m['h']);
            if ($m['w'] >= 0.9 * $W || $m['h'] >= 0.9 * $H
                || ($relleno < 0.2 && ($m['w'] > 1.8 * $altoLetra || $m['h'] > 1.25 * $altoLetra))
                || ($m['h'] <= max(3, 0.08 * $altoLetra) && $m['w'] > 0.6 * $altoLetra)
                || ($m['w'] <= max(3, 0.08 * $altoLetra) && $m['h'] > 1.12 * $altoLetra)) {
                $borrar($m['puntos']);
            }
        }
    }

    /** Manchas de tinta conectadas (8 vecinos), con su caja y sus puntos. */
    private function manchas(array $tinta, int $W, int $H): array
    {
        $visto = [];
        $res = [];
        for ($i = 0; $i < $W * $H; $i++) {
            if (! $tinta[$i] || isset($visto[$i])) {
                continue;
            }
            $pila = [$i];
            $visto[$i] = true;
            $puntos = [];
            $x0 = $W; $x1 = 0; $y0 = $H; $y1 = 0;
            while ($pila) {
                $k = array_pop($pila);
                $puntos[] = $k;
                $x = $k % $W; $y = intdiv($k, $W);
                $x0 = min($x0, $x); $x1 = max($x1, $x); $y0 = min($y0, $y); $y1 = max($y1, $y);
                for ($dy = -1; $dy <= 1; $dy++) {
                    for ($dx = -1; $dx <= 1; $dx++) {
                        $nx = $x + $dx; $ny = $y + $dy;
                        if ($nx < 0 || $ny < 0 || $nx >= $W || $ny >= $H) {
                            continue;
                        }
                        $n = $ny * $W + $nx;
                        if ($tinta[$n] && ! isset($visto[$n])) {
                            $visto[$n] = true;
                            $pila[] = $n;
                        }
                    }
                }
            }
            $res[] = ['w' => $x1 - $x0 + 1, 'h' => $y1 - $y0 + 1, 'puntos' => $puntos];
        }

        return $res;
    }

    /**
     * Banda de texto (filas con tinta) más cercana al centro del recuadro, y a
     * lo ancho, el recuadro estirado hasta el primer espacio en blanco amplio.
     *
     * @return ?array{0:int,1:int,2:int,3:int} x0, y0, x1, y1
     */
    private function ubicarLinea(GdImage $bin, int $bx0, int $bx1, int $by0, int $by1): ?array
    {
        $W = imagesx($bin);
        $H = imagesy($bin);
        $bx0 = max(0, $bx0);
        $bx1 = min($W - 1, $bx1);
        $tinta = fn (int $xx, int $yy) => (imagecolorat($bin, $xx, $yy) & 0xFF) < 128;

        // Filas con tinta dentro del ancho del recuadro.
        $minimo = max(1, (int) (($bx1 - $bx0) * 0.01));
        $filas = [];
        for ($yy = 0; $yy < $H; $yy++) {
            $n = 0;
            for ($xx = $bx0; $xx <= $bx1; $xx += 1) {
                if ($tinta($xx, $yy)) {
                    $n++;
                }
            }
            $filas[$yy] = $n >= $minimo;
        }
        $bandas = [];
        $inicio = null;
        for ($yy = 0; $yy <= $H; $yy++) {
            $hay = $filas[$yy] ?? false;
            if ($hay && $inicio === null) {
                $inicio = $yy;
            } elseif (! $hay && $inicio !== null) {
                if ($bandas && $inicio - end($bandas)[1] <= 3) {      // une cortes de 1–3 px
                    $bandas[count($bandas) - 1][1] = $yy;
                } else {
                    $bandas[] = [$inicio, $yy];
                }
                $inicio = null;
            }
        }
        $altoRecuadro = max(1, $by1 - $by0);
        $bandas = array_values(array_filter($bandas, fn ($b) => $b[1] - $b[0] >= $altoRecuadro * 0.25));
        if (! $bandas) {
            return null;
        }
        $centro = ($by0 + $by1) / 2;
        usort($bandas, fn ($a, $b) => abs(($a[0] + $a[1]) / 2 - $centro) <=> abs(($b[0] + $b[1]) / 2 - $centro));
        [$y0, $y1] = $bandas[0];

        // Columnas con tinta en esa banda; se estira cada borde hasta un blanco amplio.
        $col = [];
        for ($xx = 0; $xx < $W; $xx++) {
            $col[$xx] = false;
            for ($yy = $y0; $yy < $y1; $yy++) {
                if ($tinta($xx, $yy)) {
                    $col[$xx] = true;
                    break;
                }
            }
        }
        $hueco = max(4, (int) (($y1 - $y0) * 0.45));
        // Hasta un 25 % del ancho del recuadro: basta para no cortar un dígito y
        // no se sigue de largo por un visto hecho con bolígrafo pegado al dato.
        $tope = max(8, (int) (($bx1 - $bx0) * 0.25));
        $estirar = function (int $desde, int $paso) use ($col, $W, $hueco, $tope): int {
            $xx = $desde;
            $blancos = 0;
            while ($xx > 0 && $xx < $W - 1 && abs($xx - $desde) < $tope) {
                $blancos = $col[$xx] ? 0 : $blancos + 1;
                if ($blancos >= $hueco) {
                    return $xx - $paso * ($blancos - 1);
                }
                $xx += $paso;
            }

            return $xx;
        };
        $x0 = $estirar($bx0, -1);
        $x1 = $estirar($bx1, 1);
        if ($x1 - $x0 < 4) {
            return null;
        }
        $pad = 6;

        return [max(0, $x0 - $pad), max(0, $y0 - $pad), min($W, $x1 + $pad), min($H, $y1 + $pad)];
    }

    /**
     * Gris, suavizado, agrandado, Otsu, texto oscuro sobre blanco y borde blanco.
     *
     * @return array{0: GdImage, 1: int} la imagen y el borde agregado
     */
    private function preparar(GdImage $recorte, int $desenfoque, float $escala, string $umbral = 'otsu'): array
    {
        $this->canalRojo($recorte);
        for ($i = 0; $i < max(0, min(4, $desenfoque)); $i++) {
            imagefilter($recorte, IMG_FILTER_GAUSSIAN_BLUR);
        }

        $w = max(8, (int) round(imagesx($recorte) * $escala));
        $h = max(8, (int) round(imagesy($recorte) * $escala));
        $img = imagescale($recorte, $w, $h, IMG_BICUBIC);

        $grises = [];
        for ($yy = 0; $yy < $h; $yy++) {
            for ($xx = 0; $xx < $w; $xx++) {
                $grises[] = imagecolorat($img, $xx, $yy) & 0xFF;
            }
        }
        $tinta = $umbral === 'local' ? $this->umbralLocal($grises, $w, $h) : $this->umbralOtsu($grises);

        $borde = 24;
        $salida = imagecreatetruecolor($w + 2 * $borde, $h + 2 * $borde);
        $blanco = imagecolorallocate($salida, 255, 255, 255);
        $negro = imagecolorallocate($salida, 0, 0, 0);
        imagefill($salida, 0, 0, $blanco);
        $i = 0;
        for ($yy = 0; $yy < $h; $yy++) {
            for ($xx = 0; $xx < $w; $xx++) {
                if ($tinta[$i++]) {
                    imagesetpixel($salida, $xx + $borde, $yy + $borde, $negro);
                }
            }
        }
        imagedestroy($img);

        return [$salida, $borde];
    }

    /**
     * Gris tomado del canal rojo, no del brillo: la tinta negra y la azul de
     * las boletas quedan oscuras y las marcas de bolígrafo rojo (los vistos
     * que se hacen sobre los pesos) quedan casi blancas y desaparecen.
     */
    private function canalRojo(GdImage $img): void
    {
        imagepalettetotruecolor($img);
        $w = imagesx($img);
        $h = imagesy($img);
        for ($y = 0; $y < $h; $y++) {
            for ($x = 0; $x < $w; $x++) {
                $r = (imagecolorat($img, $x, $y) >> 16) & 0xFF;
                imagesetpixel($img, $x, $y, ($r << 16) | ($r << 8) | $r);
            }
        }
    }

    /** Umbral único (Otsu); si la mayor parte queda oscura, el fondo es oscuro y se invierte. */
    private function umbralOtsu(array $grises): array
    {
        $hist = array_fill(0, 256, 0);
        foreach ($grises as $g) {
            $hist[$g]++;
        }
        $u = $this->otsu($hist, count($grises));
        $tinta = array_map(fn ($g) => $g <= $u, $grises);
        $oscuros = count(array_filter($tinta));
        if ($oscuros > count($grises) / 2) {
            $tinta = array_map(fn ($t) => ! $t, $tinta);
        }

        return $tinta;
    }

    private function umbralLocal(array $grises, int $w, int $h): array
    {
        // Umbral local (Bradley): cada punto se compara con el promedio de su
        // vecindario, no con un umbral único. Así una sombra sobre parte del
        // ticket (la foto del celular, la mano) no vuelve negra toda la zona.
        $integral = array_fill(0, ($w + 1) * ($h + 1), 0);
        for ($yy = 0; $yy < $h; $yy++) {
            $fila = 0;
            for ($xx = 0; $xx < $w; $xx++) {
                $fila += $grises[$yy * $w + $xx];
                $integral[($yy + 1) * ($w + 1) + $xx + 1] = $integral[$yy * ($w + 1) + $xx + 1] + $fila;
            }
        }
        $r = max(8, (int) round(self::ALTO_RECORTE * 0.4));
        $tinta = [];
        for ($yy = 0; $yy < $h; $yy++) {
            $y0 = max(0, $yy - $r); $y1 = min($h, $yy + $r + 1);
            for ($xx = 0; $xx < $w; $xx++) {
                $x0 = max(0, $xx - $r); $x1 = min($w, $xx + $r + 1);
                $suma = $integral[$y1 * ($w + 1) + $x1] - $integral[$y0 * ($w + 1) + $x1]
                      - $integral[$y1 * ($w + 1) + $x0] + $integral[$y0 * ($w + 1) + $x0];
                $media = $suma / (($y1 - $y0) * ($x1 - $x0));
                $g = $grises[$yy * $w + $xx];
                $tinta[] = $g <= $media * 0.85 && $media - $g >= 20;
            }
        }

        return $tinta;
    }

    private function otsu(array $hist, int $total): int
    {
        $suma = 0;
        foreach ($hist as $i => $n) {
            $suma += $i * $n;
        }
        $sumaB = 0;
        $pesoB = 0;
        $mejor = 0;
        $umbral = 127;
        for ($t = 0; $t < 256; $t++) {
            $pesoB += $hist[$t];
            if ($pesoB === 0) {
                continue;
            }
            $pesoF = $total - $pesoB;
            if ($pesoF === 0) {
                break;
            }
            $sumaB += $t * $hist[$t];
            $mB = $sumaB / $pesoB;
            $mF = ($suma - $sumaB) / $pesoF;
            $entre = $pesoB * $pesoF * ($mB - $mF) ** 2;
            if ($entre > $mejor) {
                $mejor = $entre;
                $umbral = $t;
            }
        }

        return $umbral;
    }

    /** Palabras leídas, con su posición en la imagen. */
    private function tesseract(GdImage $img, int $psm, ?string $lista): array
    {
        $tmp = tempnam(sys_get_temp_dir(), 'ocr');
        $png = $tmp . '.png';
        imagepng($img, $png);

        $cmd = [config('services.tesseract.bin'), $png, 'stdout', '--psm', (string) $psm, '-l', config('services.tesseract.idioma', 'eng')];
        if ($lista !== null) {
            array_push($cmd, '-c', 'tessedit_char_whitelist=' . $lista);
        }
        $cmd[] = 'tsv';

        try {
            $r = Process::timeout(30)->run($cmd);
        } finally {
            @unlink($png);
            @unlink($tmp);
        }
        if (! $r->successful()) {
            throw new RuntimeException('No se pudo leer la foto con Tesseract: ' . trim($r->errorOutput() ?: 'error desconocido'));
        }

        return $this->palabras($r->output());
    }

    /** Palabras del TSV de Tesseract con su línea y confianza. */
    private function palabras(string $tsv): array
    {
        $palabras = [];
        foreach (preg_split('/\R/', $tsv) as $i => $fila) {
            $col = explode("\t", $fila);
            if ($i === 0 || count($col) < 12 || $col[0] !== '5' || trim($col[11]) === '') {
                continue;
            }
            $palabras[] = [
                'linea' => "{$col[2]}.{$col[3]}.{$col[4]}",
                'izq'   => (int) $col[6],
                'arriba' => (int) $col[7],
                'ancho' => (int) $col[8],
                'alto'  => (int) $col[9],
                'texto' => trim($col[11]),
                'conf'  => (float) $col[10],
            ];
        }

        return $palabras;
    }

    /** Líneas de todo el ticket (para buscar etiquetas). */
    private function textoCompleto(GdImage $img): array
    {
        $copia = imagecreatetruecolor(imagesx($img), imagesy($img));
        imagecopy($copia, $img, 0, 0, 0, 0, imagesx($img), imagesy($img));
        $this->canalRojo($copia);

        $tmp = tempnam(sys_get_temp_dir(), 'ocr');
        $png = $tmp . '.png';
        imagepng($copia, $png);
        imagedestroy($copia);
        try {
            $r = Process::timeout(60)->run([config('services.tesseract.bin'), $png, 'stdout', '--psm', '6',
                '-l', config('services.tesseract.idioma', 'eng'), 'tsv']);
        } finally {
            @unlink($png);
            @unlink($tmp);
        }
        if (! $r->successful()) {
            return [];
        }

        $lineas = [];
        foreach ($this->palabras($r->output()) as $p) {
            $lineas[$p['linea']][] = $p;
        }

        return array_map(function ($ps) {
            usort($ps, fn ($a, $b) => $a['izq'] <=> $b['izq']);

            return ['texto' => implode(' ', array_column($ps, 'texto')),
                    'conf'  => (int) round(array_sum(array_column($ps, 'conf')) / count($ps))];
        }, array_values($lineas));
    }

    private function buscarPorEtiqueta(array $lineas, string $etiqueta, string $tipo, int $decimales): ?array
    {
        $buscada = $this->normalizar($etiqueta);
        if ($buscada === '') {
            return null;
        }
        foreach ($lineas as $l) {
            $norm = $this->normalizar($l['texto']);
            $pos = strpos($norm, $buscada);
            if ($pos === false) {
                continue;
            }
            // Lo que viene después de la etiqueta en el texto original.
            $palabrasEtiqueta = count(preg_split('/\s+/', trim($etiqueta)));
            $resto = implode(' ', array_slice(preg_split('/\s+/', $l['texto']), $palabrasEtiqueta));
            if (preg_match('/\b' . preg_quote(mb_strtoupper(trim($etiqueta)), '/') . '\b(.*)$/iu', $l['texto'], $m)) {
                $resto = $m[1];
            }
            $valor = match ($tipo) {
                'numero'  => $this->numero($resto, $decimales),
                'digitos' => preg_match('/\d+/', $resto, $d) ? $d[0] : null,
                default   => $this->limpiarTexto($resto) ?: null,
            };
            if ($valor !== null) {
                return ['texto' => trim($resto), 'valor' => $valor, 'confianza' => $l['conf'], 'metodo' => 'etiqueta'];
            }
        }

        return null;
    }

    /**
     * El número más largo del texto. Los separadores de la impresora (12.340 o
     * 12,340) se descartan: la plantilla dice cuántos decimales imprime.
     */
    public function numero(string $texto, int $decimales = 0): ?float
    {
        if (! preg_match_all('/\d[\d.,]*/', $texto, $m)) {
            return null;
        }
        $mejor = '';
        foreach ($m[0] as $grupo) {
            $digitos = preg_replace('/\D/', '', $grupo);
            if (strlen($digitos) > strlen($mejor)) {
                $mejor = $digitos;
            }
        }
        if ($mejor === '') {
            return null;
        }

        return round(((int) $mejor) / (10 ** $decimales), $decimales);
    }

    /**
     * Placa boliviana: 3 o 4 números y 3 letras (1175PFT). Corrige las
     * confusiones típicas según la posición (T/I/l → 1 en los números,
     * 0 → O en las letras) y descarta lo que sobra, como un visto al final.
     */
    public function placa(string $texto): ?string
    {
        $t = preg_replace('/[^A-Z0-9]/', '', mb_strtoupper($texto));
        $aNumero = ['T' => '1', 'I' => '1', 'L' => '1', 'J' => '1', 'S' => '5', 'O' => '0', 'D' => '0', 'Q' => '0',
                    'B' => '8', 'Z' => '2', 'G' => '6', 'A' => '4'];
        $aLetra = ['0' => 'O', '1' => 'I', '5' => 'S', '8' => 'B', '2' => 'Z', '6' => 'G', '4' => 'A', '7' => 'T'];
        foreach ([4, 3] as $n) {
            for ($i = 0; $i + $n + 3 <= strlen($t); $i++) {
                $num = strtr(substr($t, $i, $n), $aNumero);
                $let = strtr(substr($t, $i + $n, 3), $aLetra);
                if (ctype_digit($num) && ctype_alpha($let)) {
                    return $num . $let;
                }
            }
        }

        return null;
    }

    /** Nombre en mayúsculas, sin signos sueltos ni letras aisladas al final («RUBEN V» de un visto). */
    public function nombre(string $texto): ?string
    {
        $t = trim(preg_replace('/[^A-ZÑÁÉÍÓÚ ]+/u', ' ', mb_strtoupper($texto)));
        $palabras = array_values(array_filter(preg_split('/\s+/', $t), fn ($p) => $p !== ''));
        while ($palabras && mb_strlen(end($palabras)) === 1) {
            array_pop($palabras);
        }

        return $palabras ? implode(' ', $palabras) : null;
    }

    /**
     * Fecha y hora de la boleta en formato Y-m-d H:i:s: «2026-10-23» + «08:18:23»,
     * o «23/10/2026 8:34:13» en un solo recuadro. Null si no se entiende.
     */
    public function fechaHora(?string $fecha, ?string $hora = null): ?string
    {
        $texto = trim(($fecha ?? '') . ' ' . ($hora ?? ''));
        if ($texto === '') {
            return null;
        }
        $d = $m = $a = null;
        if (preg_match('/(\d{4})[\-\/.](\d{1,2})[\-\/.](\d{1,2})/', $texto, $x)) {
            [$a, $m, $d] = [(int) $x[1], (int) $x[2], (int) $x[3]];
        } elseif (preg_match('/(\d{1,2})[\-\/.](\d{1,2})[\-\/.](\d{2,4})/', $texto, $x)) {
            [$d, $m, $a] = [(int) $x[1], (int) $x[2], (int) $x[3]];
            $a += $a < 100 ? 2000 : 0;
        }
        if (! $a || ! checkdate($m, $d, $a)) {
            return null;
        }
        $h = $i = $s = 0;
        $resto = str_replace($x[0], ' ', $texto);
        if (preg_match('/(\d{1,2}):(\d{2})(?::(\d{2}))?/', $resto, $t)) {
            [$h, $i, $s] = [(int) $t[1], (int) $t[2], (int) ($t[3] ?? 0)];
            if ($h > 23 || $i > 59 || $s > 59) {
                $h = $i = $s = 0;
            }
        }

        return sprintf('%04d-%02d-%02d %02d:%02d:%02d', $a, $m, $d, $h, $i, $s);
    }

    /** Si un dato leído tiene la forma esperada (para probar el otro umbral si no). */
    private function valido(string $campo, mixed $v): bool
    {
        return match ($campo) {
            'placa'           => $this->esPlaca($v),
            'fecha'           => $this->fechaHora((string) $v) !== null,
            'hora'            => is_string($v) && preg_match('/\d{1,2}:\d{2}/', $v) === 1,
            'productor', 'chofer' => is_string($v) && count(explode(' ', $v)) >= 2,
            default           => $v !== null && $v !== '',
        };
    }

    private function esPlaca(mixed $v): bool
    {
        return is_string($v) && preg_match('/^\d{3,4}[A-Z]{3}$/', $v) === 1;
    }

    private function limpiarTexto(string $texto): string
    {
        return trim(preg_replace('/\s+/', ' ', mb_strtoupper($texto)));
    }

    private function normalizar(string $texto): string
    {
        $t = mb_strtoupper(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $texto) ?: $texto);

        return preg_replace('/[^A-Z0-9]/', '', $t);
    }

    /** Entre las lecturas de bruto, tara y neto, la combinación que cuadra (bruto − tara = neto) con más confianza. */
    private function elegirCombinacion(array $candidatos, array &$resultado): void
    {
        $b = $candidatos['peso_bruto_kg'] ?? [];
        $t = $candidatos['tara_kg'] ?? [];
        $n = $candidatos['peso_neto_kg'] ?? [];
        $mejor = null;
        foreach ($b as $lb) {
            foreach ($t as $lt) {
                foreach ($n as $ln) {
                    if (abs(($lb['valor'] - $lt['valor']) - $ln['valor']) < 0.005) {
                        $conf = $lb['confianza'] + $lt['confianza'] + $ln['confianza'];
                        if ($mejor === null || $conf > $mejor[0]) {
                            $mejor = [$conf, $lb, $lt, $ln];
                        }
                    }
                }
            }
        }
        if ($mejor) {
            [, $resultado['peso_bruto_kg'], $resultado['tara_kg'], $resultado['peso_neto_kg']] = $mejor;

            return;
        }

        // Ninguna cuadra: si dos pesos seguros dan un tercero que difiere del leído en
        // un solo dígito, ese dígito se leyó mal (9129 leído, 9120 calculado).
        $mejorPar = null;
        $pares = [
            'tara_kg'       => fn ($x, $y) => $x - $y,   // bruto − neto
            'peso_neto_kg'  => fn ($x, $y) => $x - $y,   // bruto − tara
            'peso_bruto_kg' => fn ($x, $y) => $x + $y,   // tara + neto
        ];
        $fuentes = ['tara_kg' => [$b, $n], 'peso_neto_kg' => [$b, $t], 'peso_bruto_kg' => [$t, $n]];
        foreach ($pares as $calculado => $f) {
            [$xs, $ys] = $fuentes[$calculado];
            foreach ($xs as $lx) {
                foreach ($ys as $ly) {
                    $valor = $f($lx['valor'], $ly['valor']);
                    foreach ($candidatos[$calculado] ?? [] as $leido) {
                        if ($valor > 0 && $this->unDigito($valor, $leido['valor'])) {
                            $conf = $lx['confianza'] + $ly['confianza'];
                            if ($mejorPar === null || $conf > $mejorPar[0]) {
                                $mejorPar = [$conf, $calculado, $valor, $leido, $lx, $ly];
                            }
                        }
                    }
                }
            }
        }
        if ($mejorPar) {
            [, $calculado, $valor, $leido, $lx, $ly] = $mejorPar;
            [$kx, $ky] = match ($calculado) {
                'tara_kg'       => ['peso_bruto_kg', 'peso_neto_kg'],
                'peso_neto_kg'  => ['peso_bruto_kg', 'tara_kg'],
                'peso_bruto_kg' => ['tara_kg', 'peso_neto_kg'],
            };
            $resultado[$kx] = $lx;
            $resultado[$ky] = $ly;
            $resultado[$calculado] = ['texto' => $leido['texto'], 'valor' => $valor, 'confianza' => 0, 'metodo' => 'corregido'];
        }
    }

    /**
     * Un solo dígito de diferencia: cambiado (9129 por 9120), de más (34950 por
     * 4950, un borde leído como 3) o de menos (1097 por 10970, un 0 cortado).
     */
    private function unDigito(float $a, float $b): bool
    {
        $x = (string) (int) round($a);
        $y = (string) (int) round($b);

        return $x !== $y && levenshtein($x, $y) === 1;
    }

    /** Bruto − tara = neto. Si falta uno de los tres y hay los otros dos, se calcula. */
    private function revisarPesos(array &$r, array &$avisos): ?bool
    {
        $b = $r['peso_bruto_kg']['valor'] ?? null;
        $t = $r['tara_kg']['valor'] ?? null;
        $n = $r['peso_neto_kg']['valor'] ?? null;

        foreach (['peso_bruto_kg' => 'El bruto', 'tara_kg' => 'La tara', 'peso_neto_kg' => 'El neto'] as $k => $nombre) {
            if (($r[$k]['metodo'] ?? null) === 'corregido') {
                $avisos[] = "{$nombre} se leyó «{$r[$k]['texto']}» y no cuadraba: se tomó el que da la cuenta con los otros dos. Revíselo.";
            }
        }
        if ($b !== null && $t !== null && $n !== null) {
            $ok = abs(($b - $t) - $n) < 0.005;
            $corregido = in_array('corregido', array_column(array_intersect_key($r, array_flip(['peso_bruto_kg', 'tara_kg', 'peso_neto_kg'])), 'metodo'), true);
            if ($ok && ! $corregido) {
                // La cuenta cuadra: es la mejor señal de que los tres se leyeron bien
                // (con lista de caracteres, Tesseract suele informar confianza 0).
                foreach (['peso_bruto_kg', 'tara_kg', 'peso_neto_kg'] as $k) {
                    $r[$k]['verificado'] = true;
                }
            } elseif (! $ok) {
                $avisos[] = 'Bruto − tara no da el neto leído: revise los tres pesos contra el ticket.';
            }

            return $ok;
        }
        if ($b === null && $t !== null && $n !== null && array_key_exists('peso_bruto_kg', $r)) {
            $r['peso_bruto_kg'] = ['texto' => '', 'valor' => $t + $n, 'confianza' => 0, 'metodo' => 'calculado'];
            $avisos[] = 'El bruto no se leyó: se calculó como tara + neto.';
        } elseif ($t === null && $b !== null && $n !== null && array_key_exists('tara_kg', $r)) {
            $r['tara_kg'] = ['texto' => '', 'valor' => $b - $n, 'confianza' => 0, 'metodo' => 'calculado'];
            $avisos[] = 'La tara no se leyó: se calculó como bruto − neto.';
        }

        return null;
    }
}
