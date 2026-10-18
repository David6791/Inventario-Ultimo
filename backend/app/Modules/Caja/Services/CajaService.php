<?php

namespace App\Modules\Caja\Services;

use App\Models\User;
use App\Modules\Caja\Models\Caja;
use App\Modules\Caja\Models\Movimiento;
use App\Modules\Caja\Models\Sesion;
use App\Modules\Caja\Models\SesionSaldo;
use App\Modules\Comun\Exceptions\ErrorBaseDatos;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Operación de caja: apertura, registro y anulación de movimientos.
 *
 * Las reglas (una sola sesión abierta, saldo que no queda negativo, saldo
 * inicial tomado del cierre anterior, numeración del comprobante, no corregir
 * sino anular) viven en la base. El servicio arma las filas dentro de una
 * transacción con el usuario identificado; los errores de la base los traduce
 * ErrorBaseDatos a 422 con su mensaje en español.
 */
class CajaService
{
    // ------------------------------------------------------------ Cajas

    public function crearCaja(array $datos): Caja
    {
        return Transaccion::delUsuarioActual(fn () => Caja::create($datos)->refresh());
    }

    public function actualizarCaja(Caja $caja, array $datos): Caja
    {
        return Transaccion::delUsuarioActual(function () use ($caja, $datos) {
            $caja->update($datos);

            return $caja->refresh();
        });
    }

    /** Reemplaza la lista de cajeros de la caja. */
    public function asignarCajeros(Caja $caja, array $usuarios, User $quien): void
    {
        Transaccion::como($quien->id, function () use ($caja, $usuarios, $quien) {
            $caja->cajeros()->sync(
                collect($usuarios)->mapWithKeys(fn ($id) => [(int) $id => ['asignado_por' => $quien->id]])->all()
            );
        });
    }

    /**
     * Cómo saldrá el próximo comprobante con estos datos, sin guardar ni
     * consumir números.
     *
     * @return array{numero: ?string, repetido: bool, error: ?string}
     */
    public function vistaPrevia(array $datos, ?Caja $caja = null, ?string $fecha = null): array
    {
        if (blank($datos['formato_comprobante'] ?? null)) {
            return ['numero' => null, 'repetido' => false, 'error' => 'Escriba el formato del comprobante.'];
        }

        try {
            // Savepoint: un formato inválido levanta un error en PostgreSQL que,
            // sin él, dejaría abortada la transacción abierta.
            $numero = DB::transaction(fn () => DB::selectOne(
                'select caja.vista_previa_comprobante(?, ?, ?, ?, ?::date) as numero',
                [
                    $datos['formato_comprobante'],
                    $datos['reinicio_comprobante'] ?? 'NUNCA',
                    $datos['codigo'] ?? null,
                    $caja?->id,
                    $fecha ?? now()->toDateString(),
                ]
            )->numero);
        } catch (QueryException $e) {
            $error = ErrorBaseDatos::desde($e);
            if ($error === null) {
                throw $e;
            }

            return ['numero' => null, 'repetido' => false, 'error' => $error->mensaje];
        }

        return [
            'numero'   => $numero,
            'repetido' => Movimiento::where('numero', $numero)->exists(),
            'error'    => null,
        ];
    }

    // ---------------------------------------------------------- Apertura

    /**
     * Con qué saldo arrancaría cada moneda si la caja se abre ahora: lo contado
     * en el último cierre, o null si nunca se cerró en esa moneda (entonces el
     * cajero lo digita).
     *
     * @return array<string, ?string>
     */
    public function saldosDeArranque(Caja $caja): array
    {
        $arranque = [];

        foreach ($caja->monedas() as $moneda) {
            $fila = DB::selectOne(
                "select ss.saldo_contado
                   from caja.sesion_saldo ss
                   join caja.sesion s on s.id = ss.sesion_id
                  where s.caja_id = ? and s.estado <> 'ABIERTA' and ss.moneda = ?
                  order by s.numero desc
                  limit 1",
                [$caja->id, $moneda]
            );

            $arranque[$moneda] = $fila?->saldo_contado;
        }

        return $arranque;
    }

    /**
     * Abre la sesión. $saldosIniciales solo cuenta para las monedas que nunca
     * se cerraron: en las demás la base pone lo contado en el cierre anterior,
     * digite lo que digite el cajero.
     *
     * @param  array<string, float|string|null>  $saldosIniciales  ['BOB' => 1500, 'USD' => 0]
     */
    public function abrir(Caja $caja, User $cajero, array $saldosIniciales = []): Sesion
    {
        return Transaccion::como($cajero->id, function () use ($caja, $cajero, $saldosIniciales) {
            $sesion = Sesion::create(['caja_id' => $caja->id, 'abierta_por' => $cajero->id]);

            foreach ($caja->monedas() as $moneda) {
                SesionSaldo::create([
                    'sesion_id'     => $sesion->id,
                    'moneda'        => $moneda,
                    'saldo_inicial' => $saldosIniciales[$moneda] ?? 0,
                ]);
            }

            return $sesion->refresh();
        });
    }

    // ------------------------------------------------------- Movimientos

    public function registrar(Sesion $sesion, User $cajero, array $datos): Movimiento
    {
        return Transaccion::como($cajero->id, function () use ($sesion, $cajero, $datos) {
            $movimiento = Movimiento::create([
                ...$datos,
                'sesion_id'      => $sesion->id,
                'registrado_por' => $cajero->id,
            ]);

            return $movimiento->refresh();
        });
    }

    public function anular(Movimiento $movimiento, User $usuario, string $motivo): Movimiento
    {
        return Transaccion::como($usuario->id, function () use ($movimiento, $usuario, $motivo) {
            // forceFill: estas columnas no son asignables desde un formulario.
            $movimiento->forceFill([
                'estado'           => Movimiento::ANULADO,
                'anulado_por'      => $usuario->id,
                'anulado_en'       => now(),
                'motivo_anulacion' => $motivo,
            ])->save();

            return $movimiento->refresh();
        });
    }

    // ------------------------------------------------------------ Lectura

    /**
     * Resumen por moneda de la sesión (caja.v_sesion_resumen): inicial,
     * ingresos y egresos en efectivo y en otras formas, y saldo actual.
     */
    public function resumen(Sesion $sesion): array
    {
        return collect(DB::select(
            'select * from caja.v_sesion_resumen where sesion_id = ? order by moneda',
            [$sesion->id]
        ))->map(fn ($fila) => (array) $fila)->all();
    }
}
