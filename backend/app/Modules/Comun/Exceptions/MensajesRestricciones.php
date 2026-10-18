<?php

namespace App\Modules\Comun\Exceptions;

/**
 * Mensajes en español para las restricciones de los esquemas comun, caja y
 * cargas. Las reglas escritas con RAISE EXCEPTION ya traen su mensaje; estas
 * son las CHECK, UNIQUE, EXCLUDE y claves foráneas, cuyo texto original de
 * PostgreSQL no sirve para mostrar en pantalla.
 *
 * Al agregar una restricción con nombre propio (ck_, uq_, ux_, ex_), sumar
 * aquí su mensaje. Las que no estén usan un mensaje genérico.
 */
final class MensajesRestricciones
{
    private const VIGENCIA = 'La vigencia debe terminar después de empezar.';

    public const MENSAJES = [
        // ---- cargas: catálogos
        'ck_productor_cooperativa'       => 'Un productor cooperativista debe pertenecer a una cooperativa.',
        'ck_productor_identificacion'    => 'Indique el CI o el NIT del productor.',
        'productor_ci_key'               => 'Ya existe un productor con ese CI.',
        'productor_nit_key'              => 'Ya existe un productor con ese NIT.',
        'productor_nim_key'              => 'Ya existe un productor con ese NIM.',
        'ux_cooperativa_nombre'          => 'Ya existe una cooperativa con ese nombre.',
        'cooperativa_nit_key'            => 'Ya existe una cooperativa con ese NIT.',
        'cooperativa_nim_key'            => 'Ya existe una cooperativa con ese NIM.',
        'ck_mina_propia_sin_cooperativa' => 'Una mina propia de la empresa no pertenece a una cooperativa.',
        'ux_mina_nombre'                 => 'Ya existe una mina con ese nombre.',
        'uq_bocamina_codigo'             => 'Ya existe una bocamina con ese código en la mina.',
        'uq_municipio_nombre'            => 'Ya existe un municipio con ese nombre en el departamento.',
        'municipio_codigo_key'           => 'Ya existe un municipio con ese código.',
        'laboratorio_nombre_key'         => 'Ya existe un laboratorio con ese nombre.',
        'elemento_codigo_key'            => 'Ya existe un elemento con ese código.',
        'linea_producto_codigo_key'      => 'Ya existe una línea de producto con ese código.',
        'uq_linea_elemento'              => 'Ese elemento ya está en la línea de producto.',
        'serie_lote_prefijo_key'         => 'Ya existe una serie con ese prefijo.',
        'serie_lote_prefijo_check'       => 'El prefijo solo admite mayúsculas y números, separados por guiones (por ejemplo EC-ZN).',
        'ck_parametro_vigencia'          => self::VIGENCIA,
        'ex_parametro_solape'            => 'Ya hay un valor de ese parámetro vigente en esas fechas: cierre la vigencia anterior primero.',

        // ---- cargas: precios, cotizaciones, retenciones
        'ck_tp_vigencia'                 => self::VIGENCIA,
        'ck_tp_factor'                   => 'Las tablas por porcentaje llevan un factor de conversión mayor que cero; las tablas por punto no llevan factor.',
        'ck_tp_aprobada'                 => 'Una tabla aprobada debe indicar quién la aprobó y cuándo.',
        'ck_tp_segregacion'              => 'Quien creó la tabla de precios no puede aprobarla.',
        'ex_tp_solape'                   => 'Ya hay una tabla de precios aprobada para esa línea y elemento en esas fechas: cierre su vigencia primero.',
        'ck_tramo_rango'                 => 'En un tramo, la ley hasta debe ser mayor que la ley desde.',
        'ck_tramo_un_valor'              => 'Cada tramo lleva precio por punto o porcentaje pagable: uno de los dos.',
        'ex_tramo_solape'                => 'Ese tramo se superpone con otro de la misma tabla.',
        'uq_cotizacion_periodo'          => 'Ya hay una cotización de ese elemento para esa quincena.',
        'retencion_concepto_codigo_key'  => 'Ya existe una retención con ese código.',
        'ck_rt_vigencia'                 => self::VIGENCIA,
        'ex_rt_solape'                   => 'Ya hay una tasa de esa retención vigente en esas fechas: cierre la vigencia anterior primero.',

        // ---- cargas: lote, pesaje, bono
        'lote_codigo_key'                => 'Ya existe un lote con ese código. Revise el formato de la serie.',
        'ck_lote_origen'                 => 'Un lote de compra necesita productor; uno de producción propia necesita bocamina y no lleva productor ni cooperativa.',
        'ck_lote_anulado'                => 'Para anular el lote indique quién lo anula, cuándo y un motivo de al menos 10 caracteres.',
        'fk_lote_bocamina_de_la_mina'    => 'La bocamina elegida no pertenece a esa mina.',
        'ck_pesaje_pesos'                => 'El peso bruto debe ser mayor que la tara, y la tara no puede ser negativa.',
        'ck_pesaje_peso_cliente'         => 'El peso del cliente debe ser mayor que cero.',
        'ck_lote_material'               => 'El material debe ser ZN, AG, PB o una de sus combinaciones.',
        'ck_pesaje_anulado'              => 'Para anular el pesaje indique el motivo.',
        'uq_pesaje_ticket'               => 'Ese ticket de báscula ya está registrado.',
        'ck_btt_rango'                   => 'En un tramo de bono, el peso hasta debe ser mayor que el peso desde.',
        'ck_btt_vigencia'                => self::VIGENCIA,
        'ex_btt_solape'                  => 'Ese tramo de bono se superpone con otro vigente en las mismas fechas.',
        'bono_transporte_pesaje_id_key'  => 'Ese pesaje ya tiene su bono de transporte.',
        'bono_transporte_movimiento_caja_id_key' => 'Ese comprobante de caja ya respalda otro pago.',
        'ck_bono_pagado'                 => 'El pago del bono requiere su comprobante de caja.',
        'ck_bono_anulado'                => 'Para anular el bono indique quién lo anula, cuándo y el motivo.',

        // ---- cargas: muestreo y análisis
        'muestra_codigo_key'             => 'Ya existe una muestra con ese código.',
        'uq_porcion_destino'             => 'La muestra ya tiene una porción con ese destino.',
        'ck_analisis_laboratorio'        => 'Indique el laboratorio: solo la lectura estimada de recepción puede no tenerlo.',
        'ck_analisis_anulado'            => 'Para anular un análisis indique el motivo.',
        'uq_analisis_certificado'        => 'Ese número de certificado ya está registrado para el laboratorio.',
        'ux_analisis_vigente'            => 'La muestra ya tiene un análisis vigente de ese tipo: anule el anterior para registrar otro.',
        'uq_resultado_elemento'          => 'El análisis ya tiene un resultado para ese elemento.',
        'uq_lote_ley'                    => 'Ese elemento ya tiene ley final en el lote: modifíquela.',
        'ck_lote_ley_dirimente'          => 'Una ley fijada por dirimencia debe indicar el análisis dirimente.',

        // ---- cargas: anticipos
        'anticipo_numero_key'            => 'Número de anticipo repetido.',
        'ck_anticipo_segregacion'        => 'Quien registra un anticipo no puede autorizarlo.',
        'ck_anticipo_autorizado'         => 'El anticipo debe estar autorizado (quién y cuándo) antes de pagarse.',
        'ck_anticipo_pago'               => 'El pago del anticipo requiere su comprobante de caja.',
        'ck_anticipo_devolucion'         => 'La devolución del anticipo requiere su comprobante de caja.',
        'ck_anticipo_anulado'            => 'Para anular el anticipo indique quién lo anula, cuándo y el motivo.',
        'anticipo_movimiento_pago_id_key'       => 'Ese comprobante de caja ya respalda otro anticipo.',
        'anticipo_movimiento_devolucion_id_key' => 'Ese comprobante de caja ya respalda otra devolución.',

        // ---- caja
        'caja_codigo_key'                => 'Ya existe una caja con ese código.',
        'caja_codigo_check'              => 'El código de caja solo admite mayúsculas y números, sin espacios.',
        'concepto_codigo_key'            => 'Ya existe un concepto con ese código.',
        'ux_concepto_nombre'             => 'Ya existe un concepto con ese nombre.',
        'ux_sesion_una_abierta'          => 'La caja ya tiene una sesión abierta: ciérrela antes de abrir otra.',
        'uq_sesion_numero'               => 'Número de sesión repetido.',
        'uq_sesion_moneda'               => 'La sesión ya tiene saldo en esa moneda.',
        'ck_sesion_cerrada'              => 'Para cerrar la caja indique quién la cierra y cuándo.',
        'ck_sesion_validada'             => 'Para validar el cierre indique quién lo valida y cuándo.',
        'ck_sesion_segregacion'          => 'Quien cerró la caja no puede validar su propio cierre.',
        'uq_arqueo_corte'                => 'Ese corte ya está en el arqueo: modifique la cantidad.',
        'movimiento_numero_key'          => 'Número de comprobante repetido.',
        'ck_mov_documento'               => 'Un pago con cheque o transferencia necesita el banco y el número de documento.',
        'ck_mov_anulado'                 => 'Para anular el movimiento indique quién lo anula, cuándo y el motivo.',

        // ---- comun
        'banco_nombre_key'               => 'Ya existe un banco con ese nombre.',
    ];

    public static function para(string $sqlstate, ?string $restriccion, string $textoOriginal): string
    {
        if ($restriccion !== null && isset(self::MENSAJES[$restriccion])) {
            return self::MENSAJES[$restriccion];
        }

        return match ($sqlstate) {
            '23502' => self::faltaDato($textoOriginal),
            '23503' => (str_contains($textoOriginal, 'is still referenced') || str_contains($textoOriginal, 'todavía es referida'))
                ? 'No se puede eliminar: hay otros registros que dependen de este.'
                : 'El registro relacionado no existe.',
            '23505' => 'Ya existe un registro con esos datos.',
            '23P01' => 'Se superpone con otro registro vigente en las mismas fechas o rangos.',
            '23514' => self::valorNoValido($restriccion),
            default => 'La operación no cumple una regla de la base de datos.',
        };
    }

    private static function faltaDato(string $texto): string
    {
        if (preg_match('/(?:column "|columna «)([a-z0-9_]+)/u', $texto, $m)) {
            return 'Falta un dato obligatorio: «' . str_replace('_', ' ', $m[1]) . '».';
        }

        return 'Falta un dato obligatorio.';
    }

    private static function valorNoValido(?string $restriccion): string
    {
        // Restricciones automáticas de PostgreSQL: <tabla>_<columna>_check
        if ($restriccion !== null && preg_match('/^[a-z_]+?_([a-z0-9_]+)_check$/', $restriccion)) {
            return 'Uno de los valores no es válido (' . $restriccion . ').';
        }

        return 'Uno de los valores no es válido.';
    }
}
