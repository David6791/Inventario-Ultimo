export type EstadoDevolucion = 'registrada' | 'anulada';
export type EstadoBien = 'bueno' | 'danado';

export interface Devolucion {
  id: number;
  numero: string;
  fecha: string;
  salida_id: number;
  salida_numero: string;
  solicitante_nombre: string | null;
  unidad_nombre: string | null;
  motivo: string;
  motivo_etiqueta?: string;
  costo_total: number;
  cantidad_lineas: number;
  detalles_count?: number;
  estado: EstadoDevolucion;
  motivo_anulacion: string | null;
  nota_firmada: boolean;
  observaciones: string | null;
}

export interface DevolucionDetalle {
  id: number;
  salida_detalle_id: number;
  producto_id: number;
  producto_codigo: string;
  producto_nombre: string;
  unidad_medida: string | null;
  cantidad: number;
  costo_total: number;
  estado_bien: EstadoBien;
  observaciones: string | null;
}

/** Lo que todavía se puede devolver de una salida. */
export interface ItemDevolvible {
  salida_detalle_id: number;
  producto_id: number;
  producto_codigo: string;
  producto_nombre: string;
  cantidad_salida: number;
  cantidad_devuelta: number;
  devolvible: number;
}

export interface SalidaDevolvible {
  salida: { id: number; numero: string; fecha: string; solicitante: string | null };
  items: ItemDevolvible[];
}

export interface FiltroDevoluciones {
  desde?: string;
  hasta?: string;
  estado?: EstadoDevolucion;
  unidad_id?: number;
  buscar?: string;
}

export const MOTIVOS_DEVOLUCION = [
  { etiqueta: 'Sobrante no utilizado',        valor: 'sobrante' },
  { etiqueta: 'No correspondía a lo pedido',  valor: 'no_correspondia' },
  { etiqueta: 'Bien defectuoso o dañado',     valor: 'defectuoso' },
  { etiqueta: 'Cambio en el requerimiento',   valor: 'cambio_requerimiento' },
  { etiqueta: 'Otro motivo',                  valor: 'otro' },
];

export const MARCA_DEVOLUCION: Record<EstadoDevolucion, string> = {
  registrada: 'marca-bien',
  anulada: 'marca-alerta',
};
