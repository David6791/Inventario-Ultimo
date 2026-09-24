export type EstadoStock = 'agotado' | 'bajo' | 'normal' | 'exceso';

export interface Existencia {
  id: number;
  producto_id: number;
  almacen_id: number;

  codigo: string;
  producto: string;
  categoria: string | null;
  unidad: string;
  almacen?: string;

  cantidad: number;
  stock_minimo: number;
  stock_maximo: number | null;
  estado: EstadoStock;

  /** Null si el usuario no tiene permiso para ver costos. */
  costo_promedio: number | null;
  valor: number | null;

  ubicacion_fisica: string | null;
  ultimo_movimiento_en: string | null;
}

export interface ResumenExistencias {
  con_saldo: number;
  agotados: number;
  bajo_minimo: number;
  valor: number | null;
}

/** Una capa de costo viva. Explica a qué precio va a salir lo próximo. */
export interface CapaCosto {
  id: number;
  fecha: string;
  cantidad_inicial: number;
  cantidad_restante: number;
  costo_unitario: number | null;
  valor: number | null;
  lote: string | null;
  fecha_vencimiento: string | null;
}

export interface DetalleExistencia {
  existencia: Existencia;
  capas: CapaCosto[];
}

export interface MovimientoKardex {
  id: number;
  fecha: string;
  tipo: string;

  documento_tipo: string;
  documento_etiqueta: string;
  documento_id: number;
  documento_numero: string;

  entrada: number;
  salida: number;
  saldo: number;

  costo_unitario: number | null;
  costo_total: number | null;

  registrado_por?: string | null;
  observacion: string | null;
}

export interface EncabezadoKardex {
  producto_id: number;
  codigo: string;
  producto: string;
  categoria: string | null;
  unidad: string;
  saldo: number;
  costo_promedio: number | null;
}

export interface FiltroExistencias {
  buscar?: string;
  categoria_id?: number;
  estado?: EstadoStock;
  con_saldo?: boolean;
}

export interface FiltroKardex {
  desde?: string;
  hasta?: string;
  tipo?: string;
}

/** La marca de color de la fila, por estado de stock. */
export const MARCA_STOCK: Record<EstadoStock, string> = {
  agotado: 'marca-agotado',
  bajo:    'marca-bajo',
  normal:  '',
  exceso:  'marca-inactivo',
};

export const ETIQUETA_STOCK: Record<EstadoStock, string> = {
  agotado: 'Agotado',
  bajo:    'Bajo mínimo',
  normal:  'Normal',
  exceso:  'Sobre el máximo',
};
