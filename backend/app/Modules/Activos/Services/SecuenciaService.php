<?php

namespace App\Modules\Activos\Services;

use App\Modules\Activos\Models\Clase;
use App\Modules\Activos\Models\Parametro;
use App\Modules\Activos\Models\Subclase;
use Illuminate\Support\Facades\DB;

/**
 * Correlativos del módulo.
 *
 * No se usan sequences de PostgreSQL porque el correlativo de activos es por
 * subclase y no debe dejar huecos ante un rollback. Se bloquea la fila con
 * FOR UPDATE dentro de la transacción de negocio.
 */
class SecuenciaService
{
    public function __construct(private readonly ParametroService $parametros)
    {
    }

    public const AMBITO_ACTIVO    = 'ACTIVO';
    public const AMBITO_DOCUMENTO = 'DOCUMENTO';

    /**
     * Código completo del activo: AF-XYZ-05-02-000147
     * Debe llamarse dentro de la transacción que crea el activo.
     */
    public function generarCodigoActivo(Clase $clase, Subclase $subclase): string
    {
        $prefijo = $this->parametros->texto(Parametro::PREFIJO_CODIGO);
        $sigla   = $this->parametros->texto(Parametro::SIGLA_EMPRESA);
        $clave   = $clase->codigo . '-' . $subclase->codigo;

        $correlativo = $this->siguiente(self::AMBITO_ACTIVO, $clave);

        return sprintf(
            '%s-%s-%s-%s-%06d',
            $prefijo,
            $sigla,
            $clase->codigo,
            $subclase->codigo,
            $correlativo
        );
    }

    /** Número de documento: ASIGNACION-2026-000042 */
    public function generarNumeroDocumento(string $tipo, int $gestion): string
    {
        $clave       = $tipo . '-' . $gestion;
        $correlativo = $this->siguiente(self::AMBITO_DOCUMENTO, $clave);

        return sprintf('%s-%d-%06d', $tipo, $gestion, $correlativo);
    }

    /** Reserva y devuelve el siguiente correlativo del ámbito/clave. */
    public function siguiente(string $ambito, string $clave): int
    {
        return DB::transaction(function () use ($ambito, $clave) {
            // Crea la fila si no existe, sin romper ante concurrencia.
            DB::statement(
                'INSERT INTO activos.secuencia (ambito, clave, ultimo)
                 VALUES (?, ?, 0)
                 ON CONFLICT (ambito, clave) DO NOTHING',
                [$ambito, $clave]
            );

            $fila = DB::selectOne(
                'SELECT ultimo FROM activos.secuencia
                 WHERE ambito = ? AND clave = ?
                 FOR UPDATE',
                [$ambito, $clave]
            );

            $nuevo = ((int) $fila->ultimo) + 1;

            DB::update(
                'UPDATE activos.secuencia SET ultimo = ?
                 WHERE ambito = ? AND clave = ?',
                [$nuevo, $ambito, $clave]
            );

            return $nuevo;
        });
    }

    /** Último correlativo emitido, sin reservar. Solo para consulta. */
    public function ultimo(string $ambito, string $clave): int
    {
        $fila = DB::selectOne(
            'SELECT ultimo FROM activos.secuencia WHERE ambito = ? AND clave = ?',
            [$ambito, $clave]
        );

        return $fila ? (int) $fila->ultimo : 0;
    }
}
