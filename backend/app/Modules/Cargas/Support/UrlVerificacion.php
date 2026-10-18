<?php

namespace App\Modules\Cargas\Support;

use App\Modules\Activos\Services\ParametroService;
use App\Modules\Cargas\Models\Lote;
use Throwable;

/**
 * URL pública que lleva el QR del rótulo del lote: {base}/l/{código de verificación}.
 *
 * La base es la dirección del sistema accesible desde los teléfonos del
 * personal. Se toma, en orden:
 *   1. URL_VERIFICACION del .env;
 *   2. el parámetro URL_CONSULTA_QR de activos (el mismo de las etiquetas
 *      de bienes), para configurarla una sola vez;
 *   3. FRONTEND_URL del .env.
 */
final class UrlVerificacion
{
    public static function base(): string
    {
        $base = config('app.url_verificacion');
        if (! $base) {
            try {
                $base = (string) app(ParametroService::class)->valor('URL_CONSULTA_QR');
            } catch (Throwable) {
                $base = '';
            }
        }

        return rtrim($base ?: (string) env('FRONTEND_URL', 'http://localhost:4200'), '/');
    }

    public static function de(Lote $lote): string
    {
        return self::base() . '/l/' . $lote->codigo_verificacion;
    }
}
