<?php

namespace App\Modules\Activos\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ActivoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'codigo'       => $this->codigo,
            'denominacion' => $this->denominacion,
            'descripcion'  => $this->descripcion,

            'clase' => $this->whenLoaded('clase', fn () => [
                'id' => $this->clase->id, 'codigo' => $this->clase->codigo,
                'nombre' => $this->clase->nombre, 'deprecia' => $this->clase->deprecia,
            ]),
            'subclase' => $this->whenLoaded('subclase', fn () => [
                'id' => $this->subclase->id, 'codigo' => $this->subclase->codigo,
                'nombre' => $this->subclase->nombre,
            ]),

            'marca' => $this->marca, 'modelo' => $this->modelo, 'serie' => $this->serie,
            'chasis' => $this->chasis, 'motor' => $this->motor, 'placa' => $this->placa,
            'anio_fabricacion' => $this->anio_fabricacion,
            'es_bien_control'  => $this->es_bien_control,

            'origen' => [
                'tipo'            => $this->tipo_origen,
                'proveedor_id'    => $this->proveedor_id,
                'factura_nro'     => $this->factura_nro,
                'factura_fecha'   => $this->factura_fecha?->toDateString(),
                'acta_recepcion'  => $this->acta_recepcion_nro,
            ],

            // Las dos fechas van separadas a propósito: la incorporación es
            // contable, el inicio de uso es la base de la depreciación.
            'fecha_incorporacion' => $this->fecha_incorporacion?->toDateString(),
            'fecha_inicio_uso'    => $this->fecha_inicio_uso?->toDateString(),

            'valuacion' => [
                'moneda'            => $this->moneda,
                'tipo_cambio'       => (float) $this->tipo_cambio,
                'valor_origen'      => (float) $this->valor_origen,
                'valor_residual'    => (float) $this->valor_residual,
                'vida_util_fiscal_meses'    => $this->vida_util_fiscal_meses,
                'vida_util_economica_meses' => $this->vida_util_economica_meses,
                'regimen_fiscal'            => $this->regimen_fiscal,
                'ds5563_ddjj_presentada'    => $this->ds5563_ddjj_presentada,
            ],

            'situacion' => [
                'estado'       => $this->estado,
                'condicion'    => $this->condicion,
                'custodio_id'  => $this->custodio_id,
                'esta_asignado'=> $this->esta_asignado,
                'ubicacion'    => $this->whenLoaded('ubicacion', fn () => [
                    'id' => $this->ubicacion->id,
                    'codigo' => $this->ubicacion->codigo,
                    'nombre' => $this->ubicacion->nombre,
                    'ruta'   => $this->ubicacion->ruta,
                ]),
                'centro_costo_id' => $this->centro_costo_id,
            ],

            'costos' => $this->whenLoaded('costos', fn () => $this->costos->map(fn ($c) => [
                'concepto' => $c->concepto, 'monto' => (float) $c->monto,
                'documento' => $c->documento, 'observacion' => $c->observacion,
            ])),

            'movimientos' => $this->whenLoaded('movimientos', fn () => $this->movimientos->map(fn ($m) => [
                'tipo' => $m->tipo, 'fecha' => $m->fecha?->toIso8601String(),
                'estado_anterior' => $m->estado_anterior, 'estado_nuevo' => $m->estado_nuevo,
                'detalle' => $m->detalle, 'usuario_id' => $m->usuario_id,
            ])),

            'componentes' => ActivoResource::collection($this->whenLoaded('componentes')),
            'bien_padre_id' => $this->bien_padre_id,

            'foto_path'     => $this->foto_path,
            'observaciones' => $this->observaciones,
            'created_at'    => $this->created_at?->toIso8601String(),
        ];
    }
}
