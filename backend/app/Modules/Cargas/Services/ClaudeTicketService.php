<?php

namespace App\Modules\Cargas\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Lee una boleta de báscula con la API de Claude (visión). A diferencia de
 * Tesseract no necesita recuadros: ve la boleta entera y entiende qué es cada
 * dato, aunque el ticket venga corrido, con vistos de bolígrafo, bordes de caja
 * o junto con otro papel en el mismo escaneo.
 *
 * La respuesta llega por una herramienta con esquema fijo, así los datos
 * vienen ya ordenados. No se fuerza con tool_choice (algunos modelos no lo
 * aceptan): se pide en las instrucciones y, si el modelo contesta con texto,
 * se toma el JSON del texto. Se devuelve con la misma forma que la lectura
 * de Tesseract, para que el resto del sistema no distinga de dónde salió; la
 * cuenta bruto − tara = neto y la revisión de la persona se mantienen.
 */
class ClaudeTicketService
{
    /** Datos que se piden, con el campo del formulario al que van. */
    private const ESQUEMA = [
        'type'       => 'object',
        'properties' => [
            'balanza'       => ['type' => ['string', 'null'], 'description' => 'Empresa de la balanza'],
            'ticket'        => ['type' => ['string', 'null'], 'description' => 'N.º de ticket o pesaje, solo dígitos'],
            'numero_orden'  => ['type' => ['string', 'null'], 'description' => 'N.º de orden, solo dígitos'],
            'peso_bruto_kg' => ['type' => ['number', 'null'], 'description' => 'Camión cargado, el mayor (Bruto, Peso 1, Entrada, Ingreso)'],
            'tara_kg'       => ['type' => ['number', 'null'], 'description' => 'Camión vacío (Tara, Peso 2, Salida)'],
            'peso_neto_kg'  => ['type' => ['number', 'null'], 'description' => 'Neto impreso (bruto − tara)'],
            'placa'         => ['type' => ['string', 'null'], 'description' => 'Sin guion, p. ej. 2261DKE'],
            'productor'     => ['type' => ['string', 'null'], 'description' => 'Productor, socio o cliente'],
            'chofer'        => ['type' => ['string', 'null'], 'description' => 'Chofer o transportista'],
            'fecha'         => ['type' => ['string', 'null'], 'description' => 'AAAA-MM-DD (de ingreso)'],
            'hora'          => ['type' => ['string', 'null'], 'description' => 'HH:MM:SS (de ingreso)'],
            'dudosos'       => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => 'Campos borrosos o tapados'],
            'notas'         => ['type' => ['string', 'null'], 'description' => 'Solo si hay algo raro; si no, null'],
        ],
        'required' => ['ticket', 'peso_bruto_kg', 'tara_kg', 'peso_neto_kg', 'dudosos'],
    ];

    // Corto a propósito: cada palabra se paga en cada lectura.
    private const INSTRUCCIONES = <<<'TXT'
        Boleta de báscula de camiones (Bolivia). Extrae los datos IMPRESOS con registrar_boleta.
        - Los tres pesos casi siempre están: búscalos aunque la etiqueta sea Peso 1/Peso 2, Entrada/Salida o estén en casillas.
        - Pesos en kg enteros: «9.660 KG» = 9660 (el punto separa miles). Copia el neto impreso, no lo calcules.
        - Ignora lo escrito a mano (vistos, firmas, códigos) y cualquier otro papel de la imagen.
        - Dato ausente o ilegible: null, nunca lo adivines. Si dudas, ponlo y nómbralo en «dudosos».
        - Solo la llamada a la herramienta, sin texto. Si no puedes usarla, solo el JSON.
        TXT;

    public function __construct(private readonly OcrTicketService $ocr)
    {
    }

    public function disponible(): bool
    {
        return filled(config('services.anthropic.key'));
    }

    /** @return array{campos: array, coherente: ?bool, avisos: string[], fecha_ticket: ?string, lector: string, modelo: string, uso: array, bascula: ?string} */
    public function leer(string $ruta, ?string $modelo = null): array
    {
        if (! $this->disponible()) {
            throw new RuntimeException('Falta la clave de la API de Claude (ANTHROPIC_API_KEY en backend/.env).');
        }
        $modelo ??= config('services.anthropic.modelo');
        [$tipo, $datos, $px] = $this->imagen($ruta);

        $inicio = microtime(true);
        $r = Http::withHeaders([
            'x-api-key'         => config('services.anthropic.key'),
            'anthropic-version' => '2023-06-01',
        ])->timeout(config('services.anthropic.espera', 60))->acceptJson()->post(config('services.anthropic.url'), [
            'model'       => $modelo,
            'max_tokens'  => 600,
            'tools'       => [[
                'name'         => 'registrar_boleta',
                'description'  => 'Registra los datos leídos de la boleta de báscula.',
                'input_schema' => self::ESQUEMA,
            ]],
            'tool_choice' => ['type' => 'auto'],
            'messages'    => [[
                'role'    => 'user',
                'content' => [
                    ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $tipo, 'data' => $datos]],
                    ['type' => 'text', 'text' => self::INSTRUCCIONES],
                ],
            ]],
        ]);

        if (! $r->successful()) {
            $msg = $r->json('error.message') ?? $r->body();
            throw new RuntimeException("La API de Claude respondió {$r->status()}: " . mb_substr((string) $msg, 0, 200));
        }
        $entrada = $this->entrada((array) $r->json('content', []));
        if (! is_array($entrada)) {
            throw new RuntimeException('La API de Claude no devolvió los datos de la boleta.');
        }

        $lectura = $this->convertir($entrada);
        $lectura['lector'] = 'claude';
        $lectura['respuesta'] = $entrada;          // tal cual llegó, para revisar si algo no se leyó
        $lectura['modelo'] = $r->json('model', $modelo);
        $lectura['segundos'] = round(microtime(true) - $inicio, 1);
        $lectura['uso'] = [
            'entrada' => (int) $r->json('usage.input_tokens', 0),
            'salida'  => (int) $r->json('usage.output_tokens', 0),
            'imagen'  => $px,
        ];

        return $lectura;
    }

    /** Los datos de la boleta: de la herramienta o, si contestó con texto, del JSON en el texto. */
    private function entrada(array $contenido): ?array
    {
        foreach ($contenido as $b) {
            if (($b['type'] ?? '') === 'tool_use' && ($b['name'] ?? '') === 'registrar_boleta' && is_array($b['input'] ?? null)) {
                return $b['input'];
            }
        }
        $texto = collect($contenido)->where('type', 'text')->pluck('text')->implode("\n");
        if (preg_match('/\{.*\}/s', $texto, $m)) {
            $json = json_decode($m[0], true);
            if (is_array($json) && array_intersect(array_keys($json), ['ticket', 'peso_bruto_kg', 'tara_kg', 'peso_neto_kg'])) {
                return $json;
            }
        }

        return null;
    }

    /**
     * Peso en kg. Un texto («18.660 KG») se lee por dígitos: el punto es de
     * miles. Un número con fracción de tres cifras (18.66 por 18.660) es
     * el mismo error y se corrige; los kilos con decimales de verdad no salen
     * en una boleta de camión.
     */
    private function peso(mixed $v): ?float
    {
        if ($v === null || $v === '') {
            return null;
        }
        if (is_string($v)) {
            return $this->ocr->numero($v);
        }
        $n = (float) $v;
        if ($n > 0 && $n < 1000 && floor($n) != $n) {
            $n = round($n * 1000);
        }

        return $n > 0 ? $n : null;
    }

    /** De la respuesta de Claude a la forma de la lectura de Tesseract. */
    public function convertir(array $e): array
    {
        $dudosos = array_map('strval', (array) ($e['dudosos'] ?? []));
        $campos = [];
        foreach (['ticket', 'numero_orden', 'peso_bruto_kg', 'tara_kg', 'peso_neto_kg', 'placa', 'productor', 'chofer', 'fecha', 'hora'] as $c) {
            if (! array_key_exists($c, $e)) {
                continue;
            }
            $v = $e[$c];
            if (is_string($v)) {
                $v = trim($v) === '' ? null : trim($v);
            }
            $valor = match ($c) {
                'peso_bruto_kg', 'tara_kg', 'peso_neto_kg' => $this->peso($v),
                'ticket', 'numero_orden' => $v !== null ? (preg_replace('/\D/', '', (string) $v) ?: null) : null,
                'placa'     => $v !== null ? ($this->ocr->placa((string) $v) ?? mb_strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $v))) : null,
                'productor', 'chofer' => $v !== null ? mb_strtoupper(preg_replace('/\s+/u', ' ', (string) $v)) : null,
                default     => $v,
            };
            $dudoso = in_array($c, $dudosos, true);
            $campos[$c] = ['texto' => $v === null ? '' : (string) $v, 'valor' => $valor,
                           'confianza' => $valor === null ? 0 : ($dudoso ? 50 : 95), 'metodo' => 'claude'];
        }

        $avisos = [];
        if ($dudosos) {
            $avisos[] = 'Claude marcó para revisar: ' . implode(', ', $dudosos) . '.';
        }
        if (! empty($e['notas'])) {
            $avisos[] = 'Nota de la lectura: ' . $e['notas'];
        }
        $coherente = $this->ocr->revisarPesos($campos, $avisos);
        foreach (['peso_bruto_kg', 'tara_kg', 'peso_neto_kg'] as $k) {
            if (isset($campos[$k]) && in_array($k, $dudosos, true)) {
                unset($campos[$k]['verificado']);       // dudoso: se revisa aunque cuadre
            }
        }

        return [
            'campos'       => $campos,
            'coherente'    => $coherente,
            'avisos'       => $avisos,
            'fecha_ticket' => $this->ocr->fechaHora($campos['fecha']['valor'] ?? null, $campos['hora']['valor'] ?? null),
            'bascula'      => isset($e['balanza']) && $e['balanza'] ? mb_strtoupper(trim($e['balanza'])) : null,
        ];
    }

    /**
     * La imagen en JPEG con el lado mayor de ANTHROPIC_LADO_MAX px (1.100). La
     * imagen es casi todo el costo: tokens ≈ ancho × alto / 750, así que a
     * 1.100 px una boleta cuesta unos 1.200 tokens en vez de unos 2.400 a 1.568.
     * Si se leen mal letras chicas, se sube; con «Comparar con Claude» se ve.
     *
     * @return array{0: string, 1: string, 2: string} tipo, datos en base64 y tamaño enviado
     */
    private function imagen(string $ruta): array
    {
        $img = @imagecreatefromstring((string) @file_get_contents($ruta));
        if (! $img) {
            throw new RuntimeException('No se pudo abrir la imagen de la boleta.');
        }
        $w = imagesx($img);
        $h = imagesy($img);
        $lado = max(600, (int) config('services.anthropic.lado_max', 1100));
        $escala = min(1, $lado / max($w, $h));
        if ($escala < 1) {
            $chica = imagescale($img, (int) round($w * $escala), (int) round($h * $escala), IMG_BICUBIC);
            imagedestroy($img);
            $img = $chica;
        }
        $px = imagesx($img) . '×' . imagesy($img);
        ob_start();
        imagejpeg($img, null, 85);
        $bytes = ob_get_clean();
        imagedestroy($img);

        return ['image/jpeg', base64_encode($bytes), $px];
    }
}
