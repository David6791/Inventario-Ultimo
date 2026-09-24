import { EstadoDocumento } from './salida.models';

export type TipoDocumentoIngreso = 'factura' | 'nota-entrega' | 'acta' | 'otro';

export interface IngresoDetalle {
  id?: number;
  producto_id: number;
  solicitud_compra_detalle_id: number;
  codigo?: string | null;
  producto?: string | null;
  unidad?: string | null;

  cantidad: number;
  costo_unitario: number;
  importe?: number;

  lote: string | null;
  fecha_vencimiento: string | null;
  observacion: string | null;

  /** Solo en el formulario: lo que falta recibir de esa línea. */
  saldo?: number;
  cantidad_solicitada?: number;
  permite_decimales?: boolean;
  controla_lote?: boolean;
  controla_vencimiento?: boolean;
}

export interface Ingreso {
  id: number;
  numero: string;
  fecha: string;

  almacen_id: number;
  almacen?: string;

  solicitud_compra_id: number;
  solicitud_numero?: string;

  proveedor: string;
  tipo_documento: TipoDocumentoIngreso;
  numero_documento: string | null;
  fecha_documento: string | null;
  observaciones: string | null;

  estado: EstadoDocumento;
  estado_etiqueta: string;
  editable: boolean;

  tiene_respaldo: boolean;
  respaldo_nombre: string | null;
  respaldo_subido_en: string | null;

  confirmada_en: string | null;
  registrado_por?: string;
  confirmada_por?: string | null;

  motivo_anulacion: string | null;
  anulada_en: string | null;

  detalles?: IngresoDetalle[];
  valor_total?: number;
  lineas?: number;
  creado_en?: string;
}

export interface IngresoPayload {
  solicitud_compra_id?: number;
  fecha: string;
  proveedor: string;
  tipo_documento: TipoDocumentoIngreso;
  numero_documento: string | null;
  fecha_documento: string | null;
  observaciones: string | null;
  detalles: Array<{
    solicitud_compra_detalle_id: number;
    cantidad: number;
    costo_unitario: number;
    lote: string | null;
    fecha_vencimiento: string | null;
    observacion: string | null;
  }>;
}

/** Línea pendiente de una solicitud aprobada, para armar el ingreso. */
export interface LineaPendiente {
  solicitud_compra_detalle_id: number;
  producto_id: number;
  codigo: string;
  producto: string;
  unidad: string;
  permite_decimales: boolean;
  controla_lote: boolean;
  controla_vencimiento: boolean;
  cantidad_solicitada: number;
  saldo: number;
  especificacion: string | null;
}

export interface SolicitudPendiente {
  id: number;
  numero: string;
  fecha: string;
  unidad_solicitante: string;
  estado_etiqueta: string;
  detalles: LineaPendiente[];
}

export interface FiltroIngresos {
  estado?: EstadoDocumento;
  sin_respaldo?: boolean;
  solicitud_id?: number;
  buscar?: string;
  desde?: string;
  hasta?: string;
}

export const TIPOS_DOCUMENTO = [
  { etiqueta: 'Factura', valor: 'factura' },
  { etiqueta: 'Nota de entrega', valor: 'nota-entrega' },
  { etiqueta: 'Acta de recepción', valor: 'acta' },
  { etiqueta: 'Otro', valor: 'otro' },
];

export const MARCA_INGRESO: Record<EstadoDocumento, string> = {
  borrador:   'marca-inactivo',
  confirmada: '',
  anulada:    'marca-agotado',
};
