<?php

namespace App\Services;

use App\Models\CapaExistencia;
use App\Models\ConsumoCapa;
use App\Models\Existencia;
use App\Models\MovimientoKardex;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use RuntimeException;

/**
 * El único lugar donde cambian las existencias.
 *
 * Todo movimiento pasa por acá: ingresos, salidas y transferencias.
 * Concentrarlo evita que dos módulos calculen el saldo de forma distinta, que es
 * como los inventarios terminan descuadrados.
 *
 * COSTEO PEPS
 * -----------
 * Cada ingreso crea una capa con su cantidad y su precio. Las salidas consumen
 * capas por antigüedad, y una sola línea puede tocar varias a precios distintos.
 * Cada consumo queda registrado: sin ese detalle no se puede anular un
 * movimiento sin descuadrar el costeo.
 *
 * La tabla `existencias` guarda el saldo total y un costo promedio DERIVADO,
 * que sirve para mostrar rápido. La verdad del costo está en las capas.
 *
 * Todos los métodos deben llamarse dentro de una transacción del llamador.
 */
class MovimientoService
{
    // =========================================================================
    // Ingresos
    // =========================================================================

    /** Registra una entrada: crea la capa de costo y sube el saldo. */
    public function registrarIngreso(
        int $productoId,
        int $almacenId,
        float $cantidad,
        float $costoUnitario,
        Model $documento,
        string $documentoTipo,
        int $usuarioId,
        ?int $ingresoDetalleId = null,
        ?string $lote = null,
        ?string $fechaVencimiento = null,
        ?string $observacion = null,
    ): MovimientoKardex {
        $existencia = $this->bloquear($productoId, $almacenId);

        CapaExistencia::create([
            'producto_id'        => $productoId,
            'almacen_id'         => $almacenId,
            'ingreso_detalle_id' => $ingresoDetalleId,
            // La fecha del documento, no la del registro: si se carga con
            // atraso, la capa igual entra en su lugar en el orden PEPS.
            'fecha'              => $documento->fecha ?? now(),
            'cantidad_inicial'   => $cantidad,
            'cantidad_restante'  => $cantidad,
            'costo_unitario'     => $costoUnitario,
            'lote'               => $lote,
            'fecha_vencimiento'  => $fechaVencimiento,
        ]);

        $saldoNuevo = (float) $existencia->cantidad + $cantidad;
        $this->actualizarSaldo($existencia, $productoId, $almacenId, $saldoNuevo);

        return $this->escribirKardex(
            $productoId, $almacenId, 'ingreso', $documentoTipo, $documento,
            entrada: $cantidad, salida: 0, saldo: $saldoNuevo,
            costoUnitario: $costoUnitario, costoTotal: $costoUnitario * $cantidad,
            usuarioId: $usuarioId, observacion: $observacion,
            fecha: $documento->fecha ?? now(),
        );
    }

    /**
     * Elimina la capa de un ingreso anulado y baja el saldo.
     *
     * @throws RuntimeException si la capa ya fue consumida
     */
    public function revertirIngreso(
        int $ingresoDetalleId,
        int $productoId,
        int $almacenId,
        float $cantidad,
        Model $documento,
        string $documentoTipo,
        int $usuarioId,
        string $motivo,
    ): MovimientoKardex {
        $existencia = $this->bloquear($productoId, $almacenId);

        $capa = CapaExistencia::where('ingreso_detalle_id', $ingresoDetalleId)
            ->lockForUpdate()
            ->first();

        if ($capa && $capa->fueConsumida()) {
            throw new RuntimeException(
                'Parte de este ingreso ya salió del almacén. '
                .'Anule primero las salidas o transferencias que lo consumieron.'
            );
        }

        $costo = $capa ? (float) $capa->costo_unitario : 0.0;
        $capa?->delete();

        $saldoNuevo = max(0, (float) $existencia->cantidad - $cantidad);
        $this->actualizarSaldo($existencia, $productoId, $almacenId, $saldoNuevo);

        return $this->escribirKardex(
            $productoId, $almacenId, 'salida', $documentoTipo.'-anulacion', $documento,
            entrada: 0, salida: $cantidad, saldo: $saldoNuevo,
            costoUnitario: $costo, costoTotal: $costo * $cantidad,
            usuarioId: $usuarioId, observacion: 'Anulación de ingreso: '.$motivo,
        );
    }

    // =========================================================================
    // Salidas
    // =========================================================================

    /**
     * Descarga existencias consumiendo capas por antigüedad.
     *
     * Devuelve el costo unitario promedio de lo consumido — que no es el
     * promedio del almacén, sino el de las capas que efectivamente salieron.
     *
     * @return array{movimiento: MovimientoKardex, costo_unitario: float}
     * @throws RuntimeException si no alcanza el saldo
     */
    public function registrarSalida(
        int $productoId,
        int $almacenId,
        float $cantidad,
        Model $documento,
        string $documentoTipo,
        int $usuarioId,
        ?int $salidaDetalleId = null,
        ?string $observacion = null,
    ): array {
        $existencia = $this->bloquear($productoId, $almacenId);
        $saldoAnterior = (float) $existencia->cantidad;

        if ($cantidad > $saldoAnterior) {
            throw new RuntimeException(
                "Saldo insuficiente: hay {$saldoAnterior} y se intenta sacar {$cantidad}."
            );
        }

        $consumo = $this->consumirCapas($productoId, $almacenId, $cantidad);

        if ($salidaDetalleId) {
            foreach ($consumo['capas'] as $porcion) {
                ConsumoCapa::create([
                    'salida_detalle_id' => $salidaDetalleId,
                    'capa_id'           => $porcion['capa_id'],
                    'cantidad'          => $porcion['cantidad'],
                    'costo_unitario'    => $porcion['costo_unitario'],
                ]);
            }
        }

        $saldoNuevo = $saldoAnterior - $cantidad;
        $this->actualizarSaldo($existencia, $productoId, $almacenId, $saldoNuevo);

        $costoUnitario = $cantidad > 0 ? $consumo['costo_total'] / $cantidad : 0.0;

        $movimiento = $this->escribirKardex(
            $productoId, $almacenId, 'salida', $documentoTipo, $documento,
            entrada: 0, salida: $cantidad, saldo: $saldoNuevo,
            costoUnitario: $costoUnitario, costoTotal: $consumo['costo_total'],
            usuarioId: $usuarioId, observacion: $observacion,
        );

        return ['movimiento' => $movimiento, 'costo_unitario' => $costoUnitario];
    }

    /**
     * Devuelve existencias al anular una salida: repone cada capa consumida por
     * su monto exacto.
     *
     * No basta con sumar la cantidad: hay que devolverla a las capas de las que
     * salió, o el costeo de las próximas salidas queda mal.
     */
    public function revertirSalida(
        int $salidaDetalleId,
        int $productoId,
        int $almacenId,
        float $cantidad,
        Model $documento,
        string $documentoTipo,
        int $usuarioId,
        string $motivo,
    ): MovimientoKardex {
        $existencia = $this->bloquear($productoId, $almacenId);

        $costoTotal = 0.0;

        foreach (ConsumoCapa::where('salida_detalle_id', $salidaDetalleId)->get() as $consumo) {
            $capa = CapaExistencia::lockForUpdate()->find($consumo->capa_id);

            $capa?->update([
                'cantidad_restante' => (float) $capa->cantidad_restante + (float) $consumo->cantidad,
            ]);

            $costoTotal += $consumo->importe();
            $consumo->delete();
        }

        $saldoNuevo = (float) $existencia->cantidad + $cantidad;
        $this->actualizarSaldo($existencia, $productoId, $almacenId, $saldoNuevo);

        return $this->escribirKardex(
            $productoId, $almacenId, 'ingreso', $documentoTipo.'-anulacion', $documento,
            entrada: $cantidad, salida: 0, saldo: $saldoNuevo,
            costoUnitario: $cantidad > 0 ? $costoTotal / $cantidad : 0,
            costoTotal: $costoTotal,
            usuarioId: $usuarioId, observacion: 'Anulación: '.$motivo,
        );
    }

    // =========================================================================
    // Transferencias
    // =========================================================================

    /**
     * Despacha material hacia otro almacén: descuenta el origen y devuelve el
     * desglose de capas consumidas, para que el costo pueda viajar.
     *
     * No suma nada al destino: entre el despacho y la recepción el material está
     * en tránsito y no pertenece a ningún almacén.
     *
     * @return array{movimiento: MovimientoKardex, capas: list<array>}
     * @throws RuntimeException si no alcanza el saldo
     */
    public function despacharTransferencia(
        int $productoId,
        int $almacenOrigenId,
        float $cantidad,
        Model $documento,
        int $usuarioId,
        ?string $observacion = null,
    ): array {
        $existencia = $this->bloquear($productoId, $almacenOrigenId);
        $saldoAnterior = (float) $existencia->cantidad;

        if ($cantidad > $saldoAnterior) {
            throw new RuntimeException(
                "Saldo insuficiente en el almacén de origen: hay {$saldoAnterior} "
                ."y se intenta trasladar {$cantidad}."
            );
        }

        $consumo = $this->consumirCapas($productoId, $almacenOrigenId, $cantidad);

        $saldoNuevo = $saldoAnterior - $cantidad;
        $this->actualizarSaldo($existencia, $productoId, $almacenOrigenId, $saldoNuevo);

        $movimiento = $this->escribirKardex(
            $productoId, $almacenOrigenId, 'transferencia', 'transferencia-despacho', $documento,
            entrada: 0, salida: $cantidad, saldo: $saldoNuevo,
            costoUnitario: $cantidad > 0 ? $consumo['costo_total'] / $cantidad : 0,
            costoTotal: $consumo['costo_total'],
            usuarioId: $usuarioId, observacion: $observacion,
        );

        return ['movimiento' => $movimiento, 'capas' => $consumo['capas']];
    }

    /**
     * Recibe material en el almacén destino, replicando las capas que viajaron.
     *
     * Cada capa entra con SU precio de origen, no con uno nuevo. Si no, una
     * transferencia crearía o destruiría valor y el inventario valorizado
     * dejaría de cuadrar contra contabilidad.
     *
     * @param  list<array{cantidad: float, costo_unitario: float, lote?: ?string, fecha_vencimiento?: ?string}>  $capas
     */
    public function recibirTransferencia(
        int $productoId,
        int $almacenDestinoId,
        array $capas,
        Model $documento,
        int $usuarioId,
        ?string $observacion = null,
    ): MovimientoKardex {
        $existencia = $this->bloquear($productoId, $almacenDestinoId);

        $cantidad   = 0.0;
        $costoTotal = 0.0;

        foreach ($capas as $porcion) {
            CapaExistencia::create([
                'producto_id'        => $productoId,
                'almacen_id'         => $almacenDestinoId,
                'ingreso_detalle_id' => null,
                // En el destino la antigüedad PEPS se cuenta desde que el
                // material llegó a ese almacén.
                'fecha'              => now(),
                'cantidad_inicial'   => $porcion['cantidad'],
                'cantidad_restante'  => $porcion['cantidad'],
                'costo_unitario'     => $porcion['costo_unitario'],
                'lote'               => $porcion['lote'] ?? null,
                'fecha_vencimiento'  => $porcion['fecha_vencimiento'] ?? null,
            ]);

            $cantidad   += (float) $porcion['cantidad'];
            $costoTotal += (float) $porcion['cantidad'] * (float) $porcion['costo_unitario'];
        }

        $saldoNuevo = (float) $existencia->cantidad + $cantidad;
        $this->actualizarSaldo($existencia, $productoId, $almacenDestinoId, $saldoNuevo);

        return $this->escribirKardex(
            $productoId, $almacenDestinoId, 'transferencia', 'transferencia-recepcion', $documento,
            entrada: $cantidad, salida: 0, saldo: $saldoNuevo,
            costoUnitario: $cantidad > 0 ? $costoTotal / $cantidad : 0,
            costoTotal: $costoTotal,
            usuarioId: $usuarioId, observacion: $observacion,
        );
    }

    /**
     * Devuelve al origen el material de una transferencia anulada en tránsito.
     * Repone cada capa por su monto exacto.
     *
     * @param  Collection<int, \App\Models\TransferenciaCapa>  $capasViajadas
     */
    public function revertirDespacho(
        int $productoId,
        int $almacenOrigenId,
        float $cantidad,
        Collection $capasViajadas,
        Model $documento,
        int $usuarioId,
        string $motivo,
    ): MovimientoKardex {
        $existencia = $this->bloquear($productoId, $almacenOrigenId);

        $costoTotal = 0.0;

        foreach ($capasViajadas as $viaje) {
            $capa = CapaExistencia::lockForUpdate()->find($viaje->capa_origen_id);

            $capa?->update([
                'cantidad_restante' => (float) $capa->cantidad_restante + (float) $viaje->cantidad,
            ]);

            $costoTotal += $viaje->importe();
        }

        $saldoNuevo = (float) $existencia->cantidad + $cantidad;
        $this->actualizarSaldo($existencia, $productoId, $almacenOrigenId, $saldoNuevo);

        return $this->escribirKardex(
            $productoId, $almacenOrigenId, 'transferencia', 'transferencia-anulacion', $documento,
            entrada: $cantidad, salida: 0, saldo: $saldoNuevo,
            costoUnitario: $cantidad > 0 ? $costoTotal / $cantidad : 0,
            costoTotal: $costoTotal,
            usuarioId: $usuarioId, observacion: 'Anulación de transferencia: '.$motivo,
        );
    }

    // =========================================================================
    // Interno
    // =========================================================================

    /**
     * Consume capas por antigüedad y devuelve el desglose.
     *
     * Es el núcleo de PEPS, compartido por salidas y transferencias: las dos
     * sacan material del almacén y las dos necesitan saber de qué capas salió.
     *
     * @return array{capas: list<array>, costo_total: float}
     * @throws RuntimeException si las capas no cubren la cantidad
     */
    private function consumirCapas(int $productoId, int $almacenId, float $cantidad): array
    {
        $porConsumir = $cantidad;
        $costoTotal  = 0.0;
        $desglose    = [];

        // Las capas se bloquean: dos movimientos simultáneos del mismo producto
        // no pueden consumir la misma capa dos veces.
        $capas = CapaExistencia::disponibles($productoId, $almacenId)
            ->lockForUpdate()
            ->get();

        foreach ($capas as $capa) {
            if ($porConsumir <= 0) {
                break;
            }

            $deEstaCapa = min($porConsumir, (float) $capa->cantidad_restante);

            $capa->update([
                'cantidad_restante' => (float) $capa->cantidad_restante - $deEstaCapa,
            ]);

            $desglose[] = [
                'capa_id'           => $capa->id,
                'cantidad'          => $deEstaCapa,
                'costo_unitario'    => (float) $capa->costo_unitario,
                'lote'              => $capa->lote,
                'fecha_vencimiento' => $capa->fecha_vencimiento?->toDateString(),
            ];

            $costoTotal += $deEstaCapa * (float) $capa->costo_unitario;
            $porConsumir -= $deEstaCapa;
        }

        /*
        | Si quedó algo por consumir, el saldo de existencias y el de las capas
        | no coinciden. Pasa si alguien tocó la base a mano o si un ingreso se
        | registró sin capa. Se corta antes de escribir un kardex mentiroso.
        */
        if ($porConsumir > 0.0001) {
            throw new RuntimeException(
                'Las capas de costo no cubren la cantidad solicitada. '
                ."Faltan {$porConsumir} unidades sin capa asignada; el inventario está descuadrado."
            );
        }

        return ['capas' => $desglose, 'costo_total' => $costoTotal];
    }

    private function actualizarSaldo(
        Existencia $existencia, int $productoId, int $almacenId, float $saldo,
    ): void {
        $existencia->update([
            'cantidad'             => $saldo,
            'costo_promedio'       => $this->promedioDerivado($productoId, $almacenId, $saldo),
            'ultimo_movimiento_en' => now(),
        ]);
    }

    private function escribirKardex(
        int $productoId,
        int $almacenId,
        string $tipo,
        string $documentoTipo,
        Model $documento,
        float $entrada,
        float $salida,
        float $saldo,
        float $costoUnitario,
        float $costoTotal,
        int $usuarioId,
        ?string $observacion = null,
        $fecha = null,
    ): MovimientoKardex {
        return MovimientoKardex::withoutGlobalScopes()->create([
            'producto_id'      => $productoId,
            'almacen_id'       => $almacenId,
            'fecha'            => $fecha ?? now(),
            'tipo'             => $tipo,
            'documento_tipo'   => $documentoTipo,
            'documento_id'     => $documento->id,
            'documento_numero' => $documento->numero,
            'entrada'          => $entrada,
            'salida'           => $salida,
            'saldo'            => $saldo,
            'costo_unitario'   => $costoUnitario,
            'costo_total'      => $costoTotal,
            'registrado_por'   => $usuarioId,
            'observacion'      => $observacion,
        ]);
    }

    /**
     * Costo promedio DERIVADO de las capas vivas. Es un dato de presentación:
     * sirve para mostrar el valor del inventario sin recorrer capas en cada
     * consulta. La valorización real de cada movimiento sale de las capas.
     */
    private function promedioDerivado(int $productoId, int $almacenId, float $saldo): float
    {
        if ($saldo <= 0) {
            return 0.0;
        }

        $valor = CapaExistencia::query()
            ->where('producto_id', $productoId)
            ->where('almacen_id', $almacenId)
            ->where('cantidad_restante', '>', 0)
            ->get()
            ->sum(fn ($c) => (float) $c->cantidad_restante * (float) $c->costo_unitario);

        return round($valor / $saldo, 4);
    }

    /**
     * Trae la fila de existencias con bloqueo, creándola si no existe.
     *
     * El bloqueo evita que dos movimientos simultáneos del mismo producto lean
     * el mismo saldo. El CHECK de la tabla es la segunda red, no la primera.
     */
    private function bloquear(int $productoId, int $almacenId): Existencia
    {
        $existencia = Existencia::query()
            ->where('producto_id', $productoId)
            ->where('almacen_id', $almacenId)
            ->lockForUpdate()
            ->first();

        if ($existencia) {
            return $existencia;
        }

        Existencia::create([
            'producto_id' => $productoId,
            'almacen_id'  => $almacenId,
            'cantidad'    => 0,
        ]);

        return Existencia::query()
            ->where('producto_id', $productoId)
            ->where('almacen_id', $almacenId)
            ->lockForUpdate()
            ->firstOrFail();
    }
}
