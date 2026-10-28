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
 * La respuesta llega por una herramienta con esquema fijo (tool_choice), así
 * los datos vienen ya ordenados. Se devuelve con la misma forma que la lectura
 * de Tesseract, para que el resto del sistema no distinga de dónde salió; la
 * cuenta bruto − tara = neto y la revisión de la persona se mantienen.
 */
class ClaudeTicketService
{
    /** Datos que se piden, con el campo del formulario al que van. */
    private const ESQUEMA = [
        'type'       => 'object',
        'properties' => [
            'balanza'       => ['type' => ['string', 'null'], 'description' => 'Nombre de la balanza o empresa que emite el ticket (p. ej. «VICTORIA», «SAN CRISTOBAL»).'],
            'ticket'        => ['type' => ['string', 'null'], 'description' => 'Número principal del ticket o de pesaje (N.º, N. Pesaje). Solo dígitos, con los ceros a la izquierda.'],
            'numero_orden'  => ['type' => ['string', 'null'], 'description' => 'Segundo número si existe (N. Orden). Solo dígitos.'],
            'peso_bruto_kg' => ['type' => ['number', 'null'], 'description' => 'Peso bruto en kg, entero (9.660 KG → 9660).'],
            'tara_kg'       => ['type' => ['number', 'null'], 'description' => 'Tara en kg, entero.'],
            'peso_neto_kg'  => ['type' => ['number', 'null'], 'description' => 'Peso neto en kg, entero.'],
            'placa'         => ['type' => ['string', 'null'], 'description' => 'Placa del vehículo: 3 o 4 números y 3 letras, sin guiones (2261DKE).'],
            'productor'     => ['type' => ['string', 'null'], 'description' => 'Productor, socio o cliente dueño del mineral, en mayúsculas con tildes.'],
            'chofer'        => ['type' => ['string', 'null'], 'description' => 'Chofer o transportista, en mayúsculas con tildes.'],
            'fecha'         => ['type' => ['string', 'null'], 'description' => 'Fecha del pesaje en formato AAAA-MM-DD (de ingreso si hay dos).'],
            'hora'          => ['type' => ['string', 'null'], 'description' => 'Hora del pesaje en formato HH:MM:SS (de ingreso si hay dos).'],
            'dudosos'       => ['type' => 'array', 'items' => ['type' => 'string'],
                                'description' => 'Nombres de los campos que se ven borrosos, tapados o cortados y conviene revisar.'],
            'notas'         => ['type' => ['string', 'null'], 'description' => 'Algo que la persona deba saber (dos boletas en la imagen, un número tachado y corregido a mano…).'],
        ],
        'required' => ['ticket', 'peso_bruto_kg', 'tara_kg', 'peso_neto_kg', 'dudosos'],
    ];

    private const INSTRUCCIONES = <<<'TXT'
        La imagen es una boleta de una báscula de camiones de Bolivia (recepción de mineral en una comercializadora).
        Extrae los datos IMPRESOS de la boleta con la herramienta registrar_boleta.

        Reglas:
        - Pesos en kilogramos como números enteros: «9.660 KG» o «9,660» son 9660. No inventes decimales.
        - Ignora lo escrito a mano (vistos, firmas, códigos como «CR-2165», círculos) salvo que corrija un número impreso; en ese caso usa el impreso y cuéntalo en «notas».
        - Si en la imagen hay otro documento además de la boleta de la báscula (un recibo, un anticipo), usa solo la boleta de la báscula.
        - Si un dato no está en la boleta o no se puede leer, devuélvelo como null. Nunca lo adivines.
        - Si dudas de un dato (borroso, tapado por un visto, cortado), ponlo igual y nómbralo en «dudosos».
        - Placa boliviana: 3 o 4 dígitos seguidos de 3 letras, sin guion.
        - No calcules el neto: copia el que está impreso.
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
        [$tipo, $datos] = $this->imagen($ruta);

        $inicio = microtime(true);
        $r = Http::withHeaders([
            'x-api-key'         => config('services.anthropic.key'),
            'anthropic-version' => '2023-06-01',
        ])->timeout(config('services.anthropic.espera', 60))->acceptJson()->post(config('services.anthropic.url'), [
            'model'       => $modelo,
            'max_tokens'  => 1024,
            'tools'       => [[
                'name'         => 'registrar_boleta',
                'description'  => 'Registra los datos leídos de la boleta de báscula.',
                'input_schema' => self::ESQUEMA,
            ]],
            'tool_choice' => ['type' => 'tool', 'name' => 'registrar_boleta'],
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
        $entrada = collect($r->json('content', []))->firstWhere('type', 'tool_use')['input'] ?? null;
        if (! is_array($entrada)) {
            throw new RuntimeException('La API de Claude no devolvió los datos de la boleta.');
        }

        $lectura = $this->convertir($entrada);
        $lectura['lector'] = 'claude';
        $lectura['modelo'] = $r->json('model', $modelo);
        $lectura['segundos'] = round(microtime(true) - $inicio, 1);
        $lectura['uso'] = [
            'entrada' => (int) $r->json('usage.input_tokens', 0),
            'salida'  => (int) $r->json('usage.output_tokens', 0),
        ];

        return $lectura;
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
                'peso_bruto_kg', 'tara_kg', 'peso_neto_kg' => is_numeric($v) ? (float) $v : ($v !== null ? $this->ocr->numero((string) $v) : null),
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
     * La imagen en JPEG y a lo sumo 1.568 px de lado mayor: más grande no mejora
     * la lectura de una boleta y cuesta más tokens.
     *
     * @return array{0: string, 1: string} tipo y datos en base64
     */
    private function imagen(string $ruta): array
    {
        $img = @imagecreatefromstring((string) @file_get_contents($ruta));
        if (! $img) {
            throw new RuntimeException('No se pudo abrir la imagen de la boleta.');
        }
        $w = imagesx($img);
        $h = imagesy($img);
        $escala = min(1, 1568 / max($w, $h));
        if ($escala < 1) {
            $chica = imagescale($img, (int) round($w * $escala), (int) round($h * $escala), IMG_BICUBIC);
            imagedestroy($img);
            $img = $chica;
        }
        ob_start();
        imagejpeg($img, null, 90);
        $bytes = ob_get_clean();
        imagedestroy($img);

        return ['image/jpeg', base64_encode($bytes)];
    }
}
