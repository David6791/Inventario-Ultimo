export interface FiltroConsumo {
  desde: string;
  hasta: string;
  almacen_id?: number;
  unidad_id?: number;
  solicitante_id?: number;
}

export interface ConsumoPorArea {
  unidad_id: number;
  unidad: string;
  salidas: number;
  solicitantes: number;
  cantidad_salida: number;
  cantidad_devuelta: number;
  cantidad_neta: number;
  costo_salida: number;
  costo_devolucion: number;
  costo_neto: number;
  participacion: number;
  costo_periodo_anterior: number;
  variacion: number;
  /** null cuando no hubo base de comparación en el periodo anterior. */
  variacion_porcentaje: number | null;
}

export interface ConsumoPorSolicitante {
  solicitante_id: number;
  solicitante: string;
  unidad_id: number;
  unidad: string;
  salidas: number;
  cantidad: number;
  costo_salida: number;
  costo_devolucion: number;
  costo_neto: number;
  participacion: number;
}

export interface ConsumoPorProducto {
  producto_id: number;
  producto_codigo: string;
  producto: string;
  categoria: string | null;
  salidas: number;
  unidades: number;
  cantidad_neta: number;
  costo_neto: number;
  costo_unitario_promedio: number;
  participacion: number;
}

export interface TotalesConsumo {
  unidades: number;
  costo_salida: number;
  costo_devolucion: number;
  costo_neto: number;
  salidas: number;
}

export interface RespuestaConsumo {
  filtros: FiltroConsumo;
  totales: TotalesConsumo;
  areas: ConsumoPorArea[];
  solicitantes: ConsumoPorSolicitante[];
  productos: ConsumoPorProducto[];
}
