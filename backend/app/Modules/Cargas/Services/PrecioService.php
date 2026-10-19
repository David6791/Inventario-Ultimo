<?php

namespace App\Modules\Cargas\Services;

use App\Models\User;
use App\Modules\Cargas\Models\Cotizacion;
use App\Modules\Cargas\Models\LineaProducto;
use App\Modules\Cargas\Models\TablaPrecio;
use App\Modules\Comun\Support\Transaccion;
use Illuminate\Support\Facades\DB;

/**
 * Tablas de precio (borrador → aprobada por otra persona), cotizaciones,
 * tasas de retención y valor estimado del lote. Las reglas de fondo
 * (huecos, bajadas, solapes, segregación, sin retroactivos) están en la
 * base (03_cargas.sql y 16_precios.sql).
 */
class PrecioService
{
    /** Crea o reemplaza un borrador con sus tramos. */
    public function guardarBorrador(array $datos, ?TablaPrecio $tabla, User $usuario): TablaPrecio
    {
        return Transaccion::como($usuario->id, function () use ($datos, $tabla, $usuario) {
            $modalidad = LineaProducto::findOrFail($datos['linea_producto_id'])->modalidad_precio;
            $cabecera = [
                'linea_producto_id' => $datos['linea_producto_id'],
                'elemento_id'       => $datos['elemento_id'],
                'modalidad'         => $modalidad,
                'moneda'            => $datos['moneda'] ?? 'BOB',
                'factor_conversion' => $modalidad === 'POR_PORCENTAJE' ? $datos['factor_conversion'] : null,
                'descripcion'       => $datos['descripcion'] ?? null,
                'vigente_desde'     => $datos['vigente_desde'],
            ];
            if ($tabla) {
                $tabla->fill($cabecera)->save();
                $tabla->tramos()->delete();
            } else {
                $tabla = TablaPrecio::create([...$cabecera, 'creado_por' => $usuario->id]);
            }
            foreach ($datos['tramos'] as $t) {
                $tabla->tramos()->create([
                    'ley_desde'          => $t['ley_desde'],
                    'ley_hasta'          => $t['ley_hasta'] ?? null,
                    'precio_punto'       => $modalidad === 'POR_PUNTO' ? $t['precio_punto'] : null,
                    'porcentaje_pagable' => $modalidad === 'POR_PORCENTAJE' ? $t['porcentaje_pagable'] : null,
                ]);
            }

            return $tabla->refresh()->load('tramos');
        });
    }

    /** Nuevo borrador con los mismos tramos, para armar la tabla que reemplazará a esta. */
    public function copiar(TablaPrecio $origen, User $usuario): TablaPrecio
    {
        return $this->guardarBorrador([
            'linea_producto_id' => $origen->linea_producto_id,
            'elemento_id'       => $origen->elemento_id,
            'moneda'            => $origen->moneda,
            'factor_conversion' => $origen->factor_conversion,
            'descripcion'       => $origen->descripcion,
            'vigente_desde'     => now()->addDay()->toDateString(),
            'tramos'            => $origen->tramos->map->only(['ley_desde', 'ley_hasta', 'precio_punto', 'porcentaje_pagable'])->all(),
        ], null, $usuario);
    }

    public function aprobar(TablaPrecio $tabla, User $usuario): TablaPrecio
    {
        return Transaccion::como($usuario->id, function () use ($tabla, $usuario) {
            DB::select('select cargas.aprobar_tabla_precio(?, ?)', [$tabla->id, $usuario->id]);

            return $tabla->refresh();
        });
    }

    public function anular(TablaPrecio $tabla, User $usuario): TablaPrecio
    {
        return Transaccion::como($usuario->id, function () use ($tabla) {
            $tabla->forceFill(['estado' => 'ANULADA'])->save();

            return $tabla->refresh();
        });
    }

    public function eliminar(TablaPrecio $tabla, User $usuario): void
    {
        Transaccion::como($usuario->id, fn () => $tabla->delete());
    }

    /**
     * Valor por TM al inicio y al final de cada tramo, para ver a simple vista
     * si la tabla está bien armada. POR_PORCENTAJE usa la cotización vigente hoy.
     */
    public function vistaPrevia(TablaPrecio $tabla): array
    {
        $cot = null;
        if ($tabla->modalidad === 'POR_PORCENTAJE') {
            $cot = $this->cotizacionVigente($tabla->elemento_id, now()->toDateString());
        }
        $anterior = null;
        $filas = [];
        foreach ($tabla->tramos as $t) {
            $valor = fn ($ley) => $ley === null ? null : ($tabla->modalidad === 'POR_PUNTO'
                ? round((float) $ley * (float) $t->precio_punto, 2)
                : ($cot ? round((float) $ley * (float) $t->porcentaje_pagable / 100 * (float) $cot['valor'] * (float) $tabla->factor_conversion, 2) : null));
            $desde = $valor($t->ley_desde);
            $filas[] = [
                'id'          => $t->id,
                'valor_desde' => $desde,
                'valor_hasta' => $valor($t->ley_hasta),
                'hueco'       => $anterior !== null && ($anterior['ley_hasta'] === null || (float) $anterior['ley_hasta'] !== (float) $t->ley_desde),
                'baja'        => $anterior !== null && $anterior['valor_hasta'] !== null && $desde !== null && $desde < $anterior['valor_hasta'],
            ];
            $anterior = ['ley_hasta' => $t->ley_hasta, 'valor_hasta' => $valor($t->ley_hasta)];
        }

        return ['cotizacion' => $cot, 'tramos' => $filas];
    }

    /** @return array{valor: string, tipo: string, unidad: string, periodo: string}|null */
    public function cotizacionVigente(int $elementoId, string $fecha): ?array
    {
        foreach (['REFERENCIA', 'OFICIAL'] as $tipo) {
            $c = Cotizacion::where('elemento_id', $elementoId)->where('tipo', $tipo)
                ->whereDate('periodo_desde', '<=', $fecha)->whereDate('periodo_hasta', '>=', $fecha)->first();
            if ($c) {
                return ['valor' => $c->valor, 'tipo' => $tipo, 'unidad' => $c->unidad,
                        'periodo' => "{$c->quincena}ª quincena " . str_pad((string) $c->mes, 2, '0', STR_PAD_LEFT) . "/{$c->anio}"];
            }
        }

        return null;
    }

    public function publicarTasa(int $concepto, ?int $cooperativa, float $porcentaje, string $desde, User $usuario): void
    {
        Transaccion::como($usuario->id, fn () => DB::select('select cargas.publicar_tasa_retencion(?, ?, ?, ?::date, ?)',
            [$concepto, $cooperativa, $porcentaje, $desde, $usuario->id]));
    }

    /** Valor estimado del lote por elemento pagable, con totales por moneda. */
    public function valorEstimado(int $loteId): array
    {
        $filas = array_map(fn ($r) => (array) $r, DB::select('select * from cargas.valor_estimado_lote(?)', [$loteId]));
        $totales = [];
        foreach ($filas as $f) {
            if ($f['valor'] !== null) {
                $totales[$f['moneda']] = round(($totales[$f['moneda']] ?? 0) + (float) $f['valor'], 2);
            }
        }
        $fuentes = array_values(array_unique(array_filter(array_column($filas, 'fuente'))));

        return [
            'elementos'  => $filas,
            'totales'    => $totales,
            'completo'   => $filas !== [] && ! array_filter($filas, fn ($f) => $f['valor'] === null),
            'definitivo' => $fuentes === ['LEY_FINAL'] && ! array_filter($filas, fn ($f) => str_starts_with((string) $f['observacion'], 'Humedad')
                                                                                         || str_starts_with((string) $f['observacion'], 'Sin humedad')),
        ];
    }
}
