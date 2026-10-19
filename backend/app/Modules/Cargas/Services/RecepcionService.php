<?php

namespace App\Modules\Cargas\Services;

use App\Models\User;
use App\Modules\Cargas\Models\BonoTransporte;
use App\Modules\Cargas\Models\Lote;
use App\Modules\Cargas\Models\Pesaje;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Support\Facades\DB;

/**
 * Recepción de mineral: el lote, sus pesajes y el bono de transporte de cada
 * pesaje de ingreso, en una sola transacción con el usuario identificado.
 *
 * El código del lote, la línea, el origen, la cooperativa y el municipio los
 * pone la base; el monto del bono sale del tramo vigente. Aquí solo se arman
 * las filas.
 */
class RecepcionService
{
    /**
     * @param  array  $lote     serie_id, almacen_id, productor_id, mina_id, bocamina_id, guia_transporte, observaciones
     * @param  ?array $pesaje   el primer pesaje, si el camión ya pasó por la báscula
     * @return array{lote: Lote, pesaje: ?Pesaje, bono: ?BonoTransporte}
     */
    public function recibir(array $lote, ?array $pesaje, User $usuario): array
    {
        return Transaccion::como($usuario->id, function () use ($lote, $pesaje, $usuario) {
            $nuevo = Lote::create([...$lote, 'registrado_por' => $usuario->id])->refresh();

            $resultado = ['lote' => $nuevo, 'pesaje' => null, 'bono' => null];
            if ($pesaje) {
                ['pesaje' => $resultado['pesaje'], 'bono' => $resultado['bono']] = $this->pesar($nuevo, $pesaje, $usuario);
            }

            return $resultado;
        });
    }

    /** @return array{pesaje: Pesaje, bono: ?BonoTransporte} */
    public function agregarPesaje(Lote $lote, array $datos, User $usuario): array
    {
        return Transaccion::como($usuario->id, fn () => $this->pesar($lote, $datos, $usuario));
    }

    public function anularPesaje(Pesaje $pesaje, string $motivo, User $usuario): Pesaje
    {
        return Transaccion::como($usuario->id, function () use ($pesaje, $motivo) {
            $pesaje->forceFill(['anulado' => true, 'motivo_anulacion' => $motivo])->save();

            return $pesaje->refresh();
        });
    }

    /** El peso del cliente es informativo: se corrige con motivo aunque el bono ya esté pagado. */
    public function corregirPesoCliente(Pesaje $pesaje, ?float $kg, string $tipo, string $motivo, User $usuario): Pesaje
    {
        return Transaccion::como($usuario->id, function () use ($pesaje, $kg, $tipo, $motivo, $usuario) {
            DB::select('select cargas.corregir_peso_cliente(?, ?, ?, ?, ?)', [$pesaje->id, $kg, $tipo, $motivo, $usuario->id]);

            return $pesaje->refresh();
        });
    }

    public function anularLote(Lote $lote, string $motivo, User $usuario): Lote
    {
        return Transaccion::como($usuario->id, function () use ($lote, $motivo, $usuario) {
            $lote->forceFill([
                'estado'           => 'ANULADO',
                'anulado_por'      => $usuario->id,
                'anulado_en'       => now(),
                'motivo_anulacion' => $motivo,
            ])->save();

            return $lote->refresh();
        });
    }

    /** Cuánto bono corresponde a un peso neto hoy (o null si ningún tramo lo cubre). */
    public function bonoPara(float $pesoNetoKg, ?string $fecha = null): ?array
    {
        $tramo = DB::selectOne(
            'select t.* from cargas.bono_transporte_tramo t where t.id = cargas.tramo_bono(?, ?::date)',
            [$pesoNetoKg, $fecha ?? now()->toDateString()]
        );

        return $tramo ? ['tramo_id' => $tramo->id, 'tipo_vehiculo' => $tramo->tipo_vehiculo,
                         'monto' => $tramo->monto, 'moneda' => $tramo->moneda] : null;
    }

    /** Pesaje y, si es de ingreso y hay tramo para su peso, su bono pendiente. */
    private function pesar(Lote $lote, array $datos, User $usuario): array
    {
        $pesaje = Pesaje::create([...$datos, 'lote_id' => $lote->id, 'registrado_por' => $usuario->id])->refresh();

        $bono = null;
        if ($pesaje->tipo === 'INGRESO' && $this->bonoPara((float) $pesaje->peso_neto_kg, $pesaje->fecha->toDateString())) {
            $bono = BonoTransporte::create([
                'pesaje_id'           => $pesaje->id,
                'beneficiario_nombre' => $pesaje->chofer_nombre,
                'beneficiario_ci'     => $pesaje->chofer_ci,
                'monto'               => 0,                    // lo fija la base con el tramo
                'registrado_por'      => $usuario->id,
            ])->refresh();
        }

        return ['pesaje' => $pesaje, 'bono' => $bono];
    }
}
