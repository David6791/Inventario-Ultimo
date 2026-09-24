<?php

namespace App\Services;

use App\Enums\MotivoDevolucion;
use App\Models\CapaExistencia;
use App\Models\ConsumoCapa;
use App\Models\Devolucion;
use App\Models\DevolucionConsumo;
use App\Models\DevolucionDetalle;
use App\Services\NumeradorService;
use App\Models\Parametro;
use App\Models\Salida;
use App\Models\SalidaDetalle;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

use RuntimeException;

/**
 * Devolucion de material al almacen.
 *
 * Dos reglas que no se negocian:
 *
 * 1. La devolucion se valoriza al costo de las capas que consumio la salida,
 *    nunca al costo actual del producto. Si salieron 10 resmas a Bs 25 de una
 *    capa vieja y hoy la capa vigente esta a Bs 32, devolver 4 descarga Bs 100.
 *
 * 2. Se restituye a la capa original, no se crea una capa nueva. Una capa nueva
 *    con fecha de hoy y costo viejo quedaria al final de la fila PEPS, y el
 *    material barato se consumiria despues del caro.
 *
 * El recorrido es en orden inverso al consumo: se devuelve primero a la ultima
 * capa consumida (LIFO sobre el consumo), que es la que estaba mas "arriba" en
 * la fila y la que menos altera el orden al restituirse.
 */
class DevolucionService
{
    public function __construct(private NumeradorService $numerador)
    {
    }
    /**
     * @param  array<int, array{salida_detalle_id:int, cantidad:float, estado_bien?:string, observaciones?:string}>  $lineas
     */
    public function registrar(Salida $salida, array $lineas, array $datos): Devolucion
    {
        if (empty($lineas)) {
            throw new RuntimeException('Debe indicar al menos un item a devolver.');
        }

        return DB::transaction(function () use ($salida, $lineas, $datos) {
            $salida = Salida::whereKey($salida->id)->lockForUpdate()->firstOrFail();

            $this->validarSalida($salida, $datos['fecha'] ?? now());

            $fecha = Carbon::parse($datos['fecha'] ?? now());
            $motivo = MotivoDevolucion::from($datos['motivo']);

            $devolucion = Devolucion::create([
                'numero' => $this->numerador->siguiente(
                    $salida->almacen_id,
                    'devolucion',
                    'DEV',
                    $salida->almacen->codigo,
                ),
                'gestion'               => $fecha->year,
                'fecha'                 => $fecha->toDateString(),
                'salida_id'             => $salida->id,
                'salida_numero'         => $salida->numero,
                'almacen_id'            => $salida->almacen_id,
                'solicitante_id'        => $salida->solicitante_id,
                'unidad_solicitante_id' => $salida->unidad_solicitante_id
                    ?? $salida->solicitante?->unidad_solicitante_id,
                'solicitante_nombre'    => $salida->solicitante?->nombre,
                'unidad_nombre'         => $salida->solicitante?->unidadSolicitante?->nombre,
                'motivo'                => $motivo,
                'observaciones'         => $datos['observaciones'] ?? null,
                'estado'                => 'registrada',
                'usuario_id'            => Auth::id(),
            ]);

            $costoTotal = 0.0;

            foreach ($lineas as $linea) {
                $costoTotal += $this->devolverLinea($devolucion, $linea, $motivo);
            }

            $devolucion->update([
                'costo_total'     => round($costoTotal, 2),
                'cantidad_lineas' => count($lineas),
            ]);

            return $devolucion->fresh('detalles.consumos');
        });
    }

    /** Deshace la devolucion: vuelve a descontar de las capas lo restituido. */
    public function anular(Devolucion $devolucion, string $motivo): Devolucion
    {
        if (! $devolucion->estaRegistrada()) {
            throw new RuntimeException('La devolucion ya fue anulada.');
        }

        return DB::transaction(function () use ($devolucion, $motivo) {
            foreach ($devolucion->detalles()->with('consumos')->get() as $detalle) {
                foreach ($detalle->consumos as $restitucion) {
                    $capa = CapaExistencia::whereKey($restitucion->capa_id)->lockForUpdate()->firstOrFail();

                    if ((float) $capa->cantidad_disponible < (float) $restitucion->cantidad) {
                        throw new RuntimeException(
                            "No se puede anular: la capa {$capa->id} ya no tiene disponible lo devuelto. "
                            .'El material devuelto volvio a salir.'
                        );
                    }

                    $capa->decrement('cantidad_disponible', (float) $restitucion->cantidad);

                    ConsumoCapa::whereKey($restitucion->consumo_capa_id)
                        ->lockForUpdate()
                        ->first()
                        ?->decrement('cantidad_devuelta', (float) $restitucion->cantidad);
                }

                SalidaDetalle::whereKey($detalle->salida_detalle_id)
                    ->lockForUpdate()
                    ->first()
                    ?->decrement('cantidad_devuelta', (float) $detalle->cantidad);
            }

            $devolucion->update([
                'estado'           => 'anulada',
                'motivo_anulacion' => $motivo,
            ]);

            return $devolucion->fresh();
        });
    }

    /** Lo que todavia se puede devolver de una salida, linea por linea. */
    public function devolvibleDe(Salida $salida): array
    {
        return $salida->detalles()
            ->with('producto:id,codigo,nombre')
            ->get()
            ->map(fn (SalidaDetalle $d) => [
                'salida_detalle_id' => $d->id,
                'producto_id'       => $d->producto_id,
                'producto_codigo'   => $d->producto?->codigo,
                'producto_nombre'   => $d->producto?->nombre,
                'cantidad_salida'   => (float) $d->cantidad,
                'cantidad_devuelta' => (float) $d->cantidad_devuelta,
                'devolvible'        => round((float) $d->cantidad - (float) $d->cantidad_devuelta, 4),
            ])
            ->filter(fn ($l) => $l['devolvible'] > 0)
            ->values()
            ->all();
    }

    // --- internos ----------------------------------------------------------

    private function devolverLinea(Devolucion $devolucion, array $linea, MotivoDevolucion $motivo): float
    {
        $salidaDetalle = SalidaDetalle::whereKey($linea['salida_detalle_id'])
            ->lockForUpdate()
            ->firstOrFail();

        if ($salidaDetalle->salida_id !== $devolucion->salida_id) {
            throw new RuntimeException('Hay un item que no pertenece a la salida indicada.');
        }

        $cantidad = round((float) $linea['cantidad'], 4);

        if ($cantidad <= 0) {
            throw new RuntimeException('La cantidad a devolver debe ser mayor a cero.');
        }

        $disponible = round((float) $salidaDetalle->cantidad - (float) $salidaDetalle->cantidad_devuelta, 4);

        if ($cantidad > $disponible) {
            throw new RuntimeException(
                "No se puede devolver {$cantidad} de {$salidaDetalle->producto?->nombre}: "
                ."quedan {$disponible} pendientes de devolucion en esa salida."
            );
        }

        $detalle = DevolucionDetalle::create([
            'devolucion_id'     => $devolucion->id,
            'salida_detalle_id' => $salidaDetalle->id,
            'producto_id'       => $salidaDetalle->producto_id,
            'producto_codigo'   => $salidaDetalle->producto?->codigo ?? '',
            'producto_nombre'   => $salidaDetalle->producto?->nombre ?? '',
            'unidad_medida'     => $salidaDetalle->producto?->unidadMedida?->codigo,
            'cantidad'          => $cantidad,
            'estado_bien'       => $linea['estado_bien'] ?? 'bueno',
            'observaciones'     => $linea['observaciones'] ?? null,
        ]);

        $costo = $this->restituirCapas($detalle, $salidaDetalle, $cantidad, $motivo);

        $detalle->update(['costo_total' => round($costo, 2)]);
        $salidaDetalle->increment('cantidad_devuelta', $cantidad);

        return $costo;
    }

    /**
     * Recorre los consumos de la linea en orden inverso y restituye,
     * respetando lo que cada consumo ya tenia devuelto.
     */
    private function restituirCapas(
        DevolucionDetalle $detalle,
        SalidaDetalle $salidaDetalle,
        float $cantidad,
        MotivoDevolucion $motivo
    ): float {
        $consumos = ConsumoCapa::where('salida_detalle_id', $salidaDetalle->id)
            ->orderByDesc('id')          // inverso al consumo
            ->lockForUpdate()
            ->get();

        $porDevolver = $cantidad;
        $costo = 0.0;

        foreach ($consumos as $consumo) {
            if ($porDevolver <= 0) {
                break;
            }

            $restante = round((float) $consumo->cantidad - (float) $consumo->cantidad_devuelta, 4);

            if ($restante <= 0) {
                continue;
            }

            $aplicar = min($porDevolver, $restante);
            $costoUnitario = (float) $consumo->costo_unitario;
            $costoLinea = round($aplicar * $costoUnitario, 2);

            DevolucionConsumo::create([
                'devolucion_detalle_id' => $detalle->id,
                'consumo_capa_id'       => $consumo->id,
                'capa_id'               => $consumo->capa_id,
                'cantidad'              => $aplicar,
                'costo_unitario'        => $costoUnitario,
                'costo_total'           => $costoLinea,
            ]);

            $consumo->increment('cantidad_devuelta', $aplicar);

            // Un bien defectuoso vuelve fisicamente pero no al stock disponible:
            // queda registrado el costo devuelto sin reponer existencia util.
            if ($motivo->reingresaAlStock()) {
                CapaExistencia::whereKey($consumo->capa_id)
                    ->lockForUpdate()
                    ->first()
                    ?->increment('cantidad_disponible', $aplicar);
            }

            $costo += $costoLinea;
            $porDevolver = round($porDevolver - $aplicar, 4);
        }

        if ($porDevolver > 0) {
            throw new RuntimeException(
                'Los consumos de la salida no alcanzan para la cantidad devuelta. '
                .'Revise la integridad del costeo de esa salida.'
            );
        }

        return $costo;
    }

    private function validarSalida(Salida $salida, $fecha): void
    {
        if ($salida->estado !== 'confirmada') {
            throw new RuntimeException('Solo se puede devolver contra una salida confirmada.');
        }

        $ventana = (int) Parametro::obtener('dias_ventana_devolucion', 30);

        if ($ventana > 0) {
            $limite = Carbon::parse($salida->fecha)->addDays($ventana);

            if (Carbon::parse($fecha)->gt($limite)) {
                throw new RuntimeException(
                    "La salida {$salida->numero} es del ".Carbon::parse($salida->fecha)->format('d/m/Y')
                    .". El plazo de {$ventana} dias para devolver vencio el ".$limite->format('d/m/Y')
                    .'. Registre el material como ingreso por otra via.'
                );
            }
        }
    }
}
