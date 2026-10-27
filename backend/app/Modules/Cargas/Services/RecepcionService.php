<?php

namespace App\Modules\Cargas\Services;

use App\Models\User;
use App\Modules\Cargas\Models\BonoTransporte;
use App\Modules\Cargas\Models\Lote;
use App\Modules\Cargas\Models\Pesaje;
use App\Modules\Cargas\Models\PesajeSaco;
use App\Modules\Cargas\Models\RecepcionFoto;
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
     * Recepción de un lote, según el tipo:
     *  - BASCULA: el lote y, si el camión ya pasó, su pesaje (con las fotos del ticket).
     *  - SACOS:   el lote y su pesaje de balanza manual (pesadas con foto).
     *  - MIXTA:   dos lotes del mismo viaje. El de granel lleva el ticket de la báscula
     *             menos el peso de los sacos; el de sacos, sus pesadas. Un solo bono.
     *
     * @param  array  $lote      serie_id, almacen_id, productor_id, mina_id, bocamina_id, guia_transporte, material, observaciones
     * @param  ?array $pesaje    pesaje de báscula, con foto_interior_id / foto_exterior_id
     * @param  ?array $sacos     bascula, pesadas [{sacos, peso_kg, foto_id}], placa, chofer_nombre, chofer_ci
     * @param  ?array $loteSacos material y observaciones del lote de sacos (mixta)
     * @return array{lote: Lote, pesaje: ?Pesaje, bono: ?BonoTransporte, lote_sacos: ?Lote}
     */
    public function recibir(array $lote, ?array $pesaje, User $usuario, string $tipo = 'BASCULA',
                            ?array $sacos = null, ?array $loteSacos = null): array
    {
        return Transaccion::como($usuario->id, function () use ($lote, $pesaje, $usuario, $tipo, $sacos, $loteSacos) {
            $nuevo = Lote::create([...$lote, 'tipo_recepcion' => $tipo, 'registrado_por' => $usuario->id])->refresh();
            $resultado = ['lote' => $nuevo, 'pesaje' => null, 'bono' => null, 'lote_sacos' => null];

            if ($tipo === 'SACOS') {
                $resultado['pesaje'] = $this->pesarSacos($nuevo, $sacos, $usuario);

                return $resultado;
            }

            if ($tipo === 'MIXTA') {
                $kgSacos = round(array_sum(array_column($sacos['pesadas'], 'peso_kg')), 2);
                $pesaje = [...$pesaje, 'descuento_sacos_kg' => $kgSacos, 'num_sacos' => null,
                           ...$this->clienteSinSacos($pesaje, $kgSacos)];
            }

            if ($pesaje) {
                ['pesaje' => $resultado['pesaje'], 'bono' => $resultado['bono']] = $this->pesar($nuevo, $pesaje, $usuario);
            }

            if ($tipo === 'MIXTA') {
                $deSacos = Lote::create([...$lote,
                    'material'      => $loteSacos['material'] ?? null,
                    'observaciones' => $loteSacos['observaciones'] ?? null,
                    'tipo_recepcion' => 'MIXTA', 'lote_par_id' => $nuevo->id, 'registrado_por' => $usuario->id])->refresh();
                $nuevo->forceFill(['lote_par_id' => $deSacos->id])->save();
                $camion = $resultado['pesaje'];
                $this->pesarSacos($deSacos, [
                    ...$sacos,
                    'placa'         => $camion->placa,
                    'chofer_nombre' => $camion->chofer_nombre,
                    'chofer_ci'     => $camion->chofer_ci,
                ], $usuario, $camion);
                $resultado['lote'] = $nuevo->refresh();
                $resultado['lote_sacos'] = $deSacos->refresh();
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

    /** Pesaje de báscula con sus fotos y, si es de ingreso y hay tramo para el camión, su bono pendiente. */
    private function pesar(Lote $lote, array $datos, User $usuario): array
    {
        $fotos = array_filter([
            $datos['foto_interior_id'] ?? null,
            $datos['foto_exterior_id'] ?? null,
        ]);
        unset($datos['foto_interior_id'], $datos['foto_exterior_id']);

        $pesaje = Pesaje::create([...$datos, 'modalidad' => 'BASCULA', 'lote_id' => $lote->id, 'registrado_por' => $usuario->id])->refresh();
        if ($fotos) {
            RecepcionFoto::whereIn('id', $fotos)->update(['pesaje_id' => $pesaje->id]);
        }

        $bono = null;
        $camion = (float) $pesaje->peso_bruto_kg - (float) $pesaje->tara_kg;    // con sacos, si es mixta
        if ($pesaje->tipo === 'INGRESO' && $this->bonoPara($camion, $pesaje->fecha->toDateString())) {
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

    /**
     * Pesaje de balanza manual: el total es la suma de las pesadas, sin tara y
     * sin ticket. Cada pesada queda con su foto. No genera bono: en la mixta el
     * bono va con el camión, y la entrega solo de sacos no pasa por báscula.
     */
    private function pesarSacos(Lote $lote, array $sacos, User $usuario, ?Pesaje $camion = null): Pesaje
    {
        $pesadas = array_values($sacos['pesadas']);
        $pesaje = Pesaje::create([
            'lote_id'         => $lote->id,
            'tipo'            => 'INGRESO',
            'modalidad'       => 'SACOS',
            'bascula'         => $sacos['bascula'],
            'ticket'          => null,
            'peso_bruto_kg'   => round(array_sum(array_column($pesadas, 'peso_kg')), 2),
            'tara_kg'         => 0,
            'num_sacos'       => array_sum(array_column($pesadas, 'sacos')),
            'placa'           => $sacos['placa'] ?? null,
            'chofer_nombre'   => $sacos['chofer_nombre'] ?? null,
            'chofer_ci'       => $sacos['chofer_ci'] ?? null,
            'pesaje_viaje_id' => $camion?->id,
            'registrado_por'  => $usuario->id,
        ])->refresh();

        foreach ($pesadas as $i => $p) {
            $fila = PesajeSaco::create(['pesaje_id' => $pesaje->id, 'orden' => $i + 1,
                                        'sacos' => (int) $p['sacos'], 'peso_kg' => $p['peso_kg']]);
            RecepcionFoto::whereKey($p['foto_id'])->update(['pesaje_saco_id' => $fila->id]);
        }

        return $pesaje->refresh();
    }

    /**
     * Mixta: el ticket exterior del cliente pesa el camión completo. Para
     * compararlo con el granel se guarda su neto menos los sacos (de un bruto
     * declarado se resta primero la tara de la empresa).
     */
    private function clienteSinSacos(array $pesaje, float $kgSacos): array
    {
        if (empty($pesaje['peso_cliente_kg'])) {
            return [];
        }
        $neto = ($pesaje['peso_cliente_tipo'] ?? 'NETO') === 'BRUTO'
            ? (float) $pesaje['peso_cliente_kg'] - (float) $pesaje['tara_kg']
            : (float) $pesaje['peso_cliente_kg'];

        return ['peso_cliente_kg' => round($neto - $kgSacos, 2), 'peso_cliente_tipo' => 'NETO'];
    }
}
