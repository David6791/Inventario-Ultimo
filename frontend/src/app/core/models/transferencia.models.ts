export type EstadoTransferencia = 'borrador' | 'despachada' | 'recibida' | 'anulada';

export interface TransferenciaDetalle {
  id?: number;
  producto_id: number;
  codigo?: string | null;
  producto?: string | null;
  unidad?: string | null;
  permite_decimales?: boolean;

  cantidad: number;
  cantidad_recibida: number | null;
  faltante?: number;
  observacion: string | null;

  /** Solo en el formulario: tope que impone la existencia del origen. */
  disponible?: number;
}

export interface Transferencia {
  id: number;
  numero: string;
  fecha: string;

  almacen_origen_id: number;
  almacen_destino_id: number;
  origen?: string;
  destino?: string;

  motivo: string | null;
  transportista: string | null;

  estado: EstadoTransferencia;
  estado_etiqueta: string;
  editable: boolean;
  en_transito: boolean;

  /*
   | Qué puede hacer este usuario con este documento.
   |
   | Lo resuelve el servidor porque depende de a qué almacén está asignado:
   | despacha quien está en el origen, recibe quien está en el destino.
   */
  puede_despachar: boolean;
  puede_recibir: boolean;

  despachada_en: string | null;
  despachada_por?: string | null;
  recibida_en: string | null;
  recibida_por?: string | null;
  observacion_recepcion: string | null;

  motivo_anulacion: string | null;
  anulada_en: string | null;
  registrado_por?: string;

  detalles?: TransferenciaDetalle[];
  tiene_faltantes?: boolean;
  lineas?: number;
  creado_en?: string;
}

export interface TransferenciaPayload {
  almacen_destino_id: number;
  fecha: string;
  motivo: string | null;
  transportista: string | null;
  detalles: Array<{
    producto_id: number;
    cantidad: number;
    observacion: string | null;
  }>;
}

export interface RecepcionPayload {
  observacion: string | null;
  detalles: Array<{ id: number; cantidad_recibida: number }>;
}

export interface FiltroTransferencias {
  estado?: EstadoTransferencia;
  en_transito?: boolean;
  por_recibir?: boolean;
  buscar?: string;
}

export const MARCA_TRANSFERENCIA: Record<EstadoTransferencia, string> = {
  borrador:   'marca-inactivo',
  despachada: 'marca-bajo',
  recibida:   '',
  anulada:    'marca-agotado',
};
