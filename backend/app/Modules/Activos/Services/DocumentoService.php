<?php

namespace App\Modules\Activos\Services;

use App\Modules\Activos\Models\Activo;
use App\Modules\Activos\Models\Documento;
use App\Modules\Activos\Models\DocumentoDetalle;
use App\Modules\Activos\Models\Movimiento;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Documentos de custodia.
 *
 * UN SOLO SERVICIO PARA LOS CUATRO TIPOS
 *
 * Asignación, traspaso, salida temporal y devolución comparten el 80 % del
 * comportamiento: numeración, estados, validación de que el activo exista y
 * no esté de baja, bitácora. Lo que cambia es el efecto al confirmar, y eso
 * vive en un único `match` por tipo.
 *
 * Tener cuatro servicios casi iguales garantiza que dentro de seis meses tres
 * tengan una corrección que el cuarto no.
 */
class DocumentoService
{
    public function __construct(private readonly SecuenciaService $secuencias)
    {
    }

    /**
     * Crea el documento en BORRADOR. Todavía no afecta a ningún activo.
     *
     * @param  list<int>  $activosIds
     */
    public function emitir(string $tipo, array $datos, array $activosIds, int $usuarioId): Documento
    {
        if (! in_array($tipo, Documento::TIPOS, true)) {
            throw new RuntimeException("Tipo de documento «{$tipo}» no reconocido.");
        }

        if (empty($activosIds)) {
            throw new RuntimeException('El documento debe incluir al menos un activo.');
        }

        return DB::transaction(function () use ($tipo, $datos, $activosIds, $usuarioId) {
            $gestion = (int) ($datos['gestion'] ?? now()->year);

            $activos = Activo::whereIn('id', $activosIds)->get();

            $this->validarActivos($tipo, $activos, $activosIds);
            $this->validarDatosDelTipo($tipo, $datos);

            $documento = Documento::create(array_merge($datos, [
                'tipo'       => $tipo,
                'numero'     => $this->secuencias->generarNumeroDocumento($tipo, $gestion),
                'gestion'    => $gestion,
                'fecha'      => $datos['fecha'] ?? now()->toDateString(),
                'estado'     => Documento::BORRADOR,
                'created_by' => $usuarioId,
                'created_at' => now(),
            ]));

            foreach ($activos as $activo) {
                DocumentoDetalle::create([
                    'documento_id'         => $documento->id,
                    'activo_id'            => $activo->id,
                    'estado_verificado'    => $activo->estado,
                    'condicion_verificada' => $activo->condicion,
                ]);
            }

            return $documento->load('detalles.activo');
        });
    }

    /**
     * Confirma el documento y aplica su efecto sobre cada activo.
     * Es el único momento en que el estado de un bien cambia.
     */
    public function confirmar(Documento $documento, int $usuarioId): Documento
    {
        if (! $documento->esBorrador()) {
            throw new RuntimeException(
                "El documento {$documento->numero} ya está {$documento->estado}."
            );
        }

        return DB::transaction(function () use ($documento, $usuarioId) {
            $documento->load('detalles.activo');

            foreach ($documento->detalles as $detalle) {
                $activo = $detalle->activo;

                // Entre la emisión y la confirmación pudo pasar cualquier
                // cosa: otra asignación, una baja. Se revalida.
                $this->validarActivoParaTipo($documento->tipo, $activo);

                $anterior = [
                    'custodio'  => $activo->custodio_id,
                    'ubicacion' => $activo->ubicacion_id,
                    'estado'    => $activo->estado,
                ];

                $cambios = $this->efectoDe($documento, $activo);
                $activo->update($cambios);

                Movimiento::create([
                    'activo_id'             => $activo->id,
                    'documento_id'          => $documento->id,
                    'tipo'                  => $documento->tipo,
                    'fecha'                 => now(),
                    'custodio_anterior_id'  => $anterior['custodio'],
                    'custodio_nuevo_id'     => $cambios['custodio_id'] ?? $anterior['custodio'],
                    'ubicacion_anterior_id' => $anterior['ubicacion'],
                    'ubicacion_nueva_id'    => $cambios['ubicacion_id'] ?? $anterior['ubicacion'],
                    'estado_anterior'       => $anterior['estado'],
                    'estado_nuevo'          => $cambios['estado'] ?? $anterior['estado'],
                    'usuario_id'            => $usuarioId,
                    'detalle'               => ['documento' => $documento->numero],
                ]);
            }

            $documento->update([
                'estado'         => Documento::CONFIRMADO,
                'confirmado_por' => $usuarioId,
                'confirmado_at'  => now(),
            ]);

            return $documento->fresh()->load('detalles.activo');
        });
    }

    /**
     * Anula un documento confirmado y revierte su efecto.
     * No se borra: la bitácora recibe un movimiento inverso.
     */
    public function anular(Documento $documento, string $motivo, int $usuarioId): Documento
    {
        if (! $documento->puedeAnularse()) {
            throw new RuntimeException(
                $documento->esBorrador()
                    ? 'Un borrador no se anula: se descarta.'
                    : "El documento {$documento->numero} ya está anulado."
            );
        }

        if (trim($motivo) === '') {
            throw new RuntimeException('La anulación requiere un motivo.');
        }

        return DB::transaction(function () use ($documento, $motivo, $usuarioId) {
            $documento->load('detalles.activo', 'movimientos');

            foreach ($documento->detalles as $detalle) {
                $activo = $detalle->activo;

                // Se vuelve al estado que el movimiento original registró como
                // anterior. Reconstruirlo desde la bitácora, y no suponerlo,
                // es lo que hace que la reversión sea exacta.
                $movimiento = $documento->movimientos
                    ->firstWhere('activo_id', $activo->id);

                if (! $movimiento) {
                    continue;
                }

                $activo->update([
                    'custodio_id'  => $movimiento->custodio_anterior_id,
                    'ubicacion_id' => $movimiento->ubicacion_anterior_id ?? $activo->ubicacion_id,
                    'estado'       => $movimiento->estado_anterior ?? $activo->estado,
                ]);

                Movimiento::create([
                    'activo_id'             => $activo->id,
                    'documento_id'          => $documento->id,
                    'tipo'                  => 'CAMBIO_ESTADO',
                    'fecha'                 => now(),
                    'custodio_anterior_id'  => $movimiento->custodio_nuevo_id,
                    'custodio_nuevo_id'     => $movimiento->custodio_anterior_id,
                    'ubicacion_anterior_id' => $movimiento->ubicacion_nueva_id,
                    'ubicacion_nueva_id'    => $movimiento->ubicacion_anterior_id,
                    'estado_anterior'       => $movimiento->estado_nuevo,
                    'estado_nuevo'          => $movimiento->estado_anterior,
                    'usuario_id'            => $usuarioId,
                    'detalle'               => [
                        'reversion_de' => $documento->numero,
                        'motivo'       => $motivo,
                    ],
                ]);
            }

            $documento->update([
                'estado'           => Documento::ANULADO,
                'anulado_por'      => $usuarioId,
                'anulado_at'       => now(),
                'motivo_anulacion' => $motivo,
            ]);

            return $documento->fresh()->load('detalles.activo');
        });
    }

    /** Registra el retorno de una salida temporal. */
    public function registrarRetorno(Documento $documento, int $usuarioId, ?string $fecha = null): Documento
    {
        if ($documento->tipo !== 'SALIDA_TEMPORAL') {
            throw new RuntimeException('Solo las salidas temporales registran retorno.');
        }

        if (! $documento->estaConfirmado()) {
            throw new RuntimeException('La salida debe estar confirmada.');
        }

        if ($documento->fecha_retorno_real) {
            throw new RuntimeException('El retorno ya fue registrado.');
        }

        return DB::transaction(function () use ($documento, $usuarioId, $fecha) {
            $documento->update(['fecha_retorno_real' => $fecha ?? now()->toDateString()]);

            foreach ($documento->detalles as $detalle) {
                $activo = $detalle->activo;

                $activo->update(['estado' => 'EN_USO']);

                Movimiento::create([
                    'activo_id'       => $activo->id,
                    'documento_id'    => $documento->id,
                    'tipo'            => 'RETORNO',
                    'fecha'           => now(),
                    'estado_anterior' => 'FUERA_DE_INSTALACION',
                    'estado_nuevo'    => 'EN_USO',
                    'usuario_id'      => $usuarioId,
                    'detalle'         => ['documento' => $documento->numero],
                ]);
            }

            return $documento->fresh()->load('detalles.activo');
        });
    }

    // ------------------------------------------------------------ Efectos

    /** Lo único que realmente distingue a un tipo de otro. */
    private function efectoDe(Documento $d, Activo $activo): array
    {
        return match ($d->tipo) {
            'ASIGNACION' => [
                'custodio_id'  => $d->custodio_destino_id,
                'ubicacion_id' => $d->ubicacion_destino_id ?? $activo->ubicacion_id,
                'estado'       => 'EN_USO',
            ],

            'TRASPASO' => array_filter([
                'custodio_id'     => $d->custodio_destino_id,
                'ubicacion_id'    => $d->ubicacion_destino_id,
                'centro_costo_id' => $d->centro_costo_destino_id,
                'estado'          => 'EN_USO',
            ], fn ($v) => $v !== null),

            'SALIDA_TEMPORAL' => ['estado' => 'FUERA_DE_INSTALACION'],

            // La devolución libera al custodio: el bien queda disponible,
            // no en uso. Es lo que permite emitir la constancia de descargo.
            'DEVOLUCION' => [
                'custodio_id' => null,
                'estado'      => 'REGISTRADO',
            ],

            default => throw new RuntimeException("Sin efecto definido para «{$d->tipo}»."),
        };
    }

    // --------------------------------------------------------- Validación

    private function validarActivos(string $tipo, $activos, array $idsPedidos): void
    {
        if ($activos->count() !== count(array_unique($idsPedidos))) {
            throw new RuntimeException('Algún activo del documento no existe.');
        }

        foreach ($activos as $activo) {
            $this->validarActivoParaTipo($tipo, $activo);
        }
    }

    private function validarActivoParaTipo(string $tipo, Activo $activo): void
    {
        if ($activo->estado === 'DADO_DE_BAJA') {
            throw new RuntimeException(
                "El activo {$activo->codigo} está dado de baja y no admite movimientos."
            );
        }

        match ($tipo) {
            'ASIGNACION' => $this->verificar(
                $activo->custodio_id === null,
                "El activo {$activo->codigo} ya está asignado. Emita un traspaso, no una asignación."
            ),

            'TRASPASO' => $this->verificar(
                $activo->custodio_id !== null,
                "El activo {$activo->codigo} no tiene custodio: corresponde una asignación."
            ),

            'SALIDA_TEMPORAL' => $this->verificar(
                $activo->estado === 'EN_USO',
                "El activo {$activo->codigo} debe estar en uso para salir de las instalaciones."
            ),

            'DEVOLUCION' => $this->verificar(
                $activo->custodio_id !== null,
                "El activo {$activo->codigo} no tiene custodio: no hay nada que devolver."
            ),

            default => null,
        };
    }

    private function validarDatosDelTipo(string $tipo, array $datos): void
    {
        match ($tipo) {
            'ASIGNACION' => $this->verificar(
                ! empty($datos['custodio_destino_id']),
                'La asignación requiere un custodio.'
            ),

            'TRASPASO' => $this->verificar(
                ! empty($datos['custodio_destino_id'])
                    || ! empty($datos['ubicacion_destino_id'])
                    || ! empty($datos['centro_costo_destino_id']),
                'El traspaso debe cambiar al menos el custodio, la ubicación o el centro de costo.'
            ),

            'SALIDA_TEMPORAL' => $this->verificar(
                ! empty($datos['fecha_retorno_comprometida'])
                    && Carbon::parse($datos['fecha_retorno_comprometida'])->isFuture(),
                'La salida temporal requiere una fecha de retorno futura: sin plazo no hay control.'
            ),

            default => null,
        };
    }

    private function verificar(bool $condicion, string $mensaje): void
    {
        if (! $condicion) {
            throw new RuntimeException($mensaje);
        }
    }
}
