/** Se conserva como tipo por si más adelante vuelve a haber variantes. */
export type TipoSolicitud = 'compra';

export type EstadoSolicitud =
  | 'borrador' | 'aprobada' | 'rechazada'
  | 'atendida_parcial' | 'atendida' | 'anulada';

export interface SolicitudDetalle {
  id?: number;
  producto_id: number;
  codigo?: string | null;
  producto?: string | null;
  unidad?: string | null;
  cantidad: number;
  cantidad_atendida?: number;
  saldo?: number;
  especificacion: string | null;

  /** Solo en el formulario de material: tope que impone la existencia. */
  disponible?: number;
  permite_decimales?: boolean;
}

/** Lo común a los dos tipos. */
export interface SolicitudBase {
  id: number;
  tipo: TipoSolicitud;
  tipo_etiqueta: string;
  numero: string;
  fecha: string;

  almacen_id: number;
  almacen?: string;

  unidad_solicitante: string;
  solicitante: string;
  justificacion: string | null;
  observaciones: string | null;

  estado: EstadoSolicitud;
  estado_etiqueta: string;
  editable: boolean;
  admite_atencion: boolean;

  documento_nombre: string | null;
  documento_url: string | null;
  fecha_aprobacion: string | null;
  observacion_aprobacion: string | null;

  registrado_por?: string;
  aprobado_por?: string | null;

  detalles?: SolicitudDetalle[];
  lineas?: number;
  creado_en?: string;
}

export interface SolicitudCompra extends SolicitudBase {
  tipo: 'compra';
  partida_presupuestaria: string | null;
  monto_estimado: number | null;
}

export type Solicitud = SolicitudCompra;

export interface SolicitudPayload {
  fecha: string;
  unidad_solicitante: string;
  solicitante: string;
  justificacion: string | null;
  observaciones: string | null;

  // Solo compra
  partida_presupuestaria?: string | null;
  monto_estimado?: number | null;

  detalles: Array<{
    producto_id: number;
    cantidad: number;
    especificacion: string | null;
  }>;
}

export interface FiltroSolicitudes {
  estado?: EstadoSolicitud;
  pendientes?: boolean;
  buscar?: string;
  desde?: string;
  hasta?: string;
}

/** Color de la marca en el borde de la fila, por estado. */
export const MARCA_ESTADO: Record<EstadoSolicitud, string> = {
  borrador:         'marca-inactivo',
  aprobada:         '',
  rechazada:        'marca-agotado',
  atendida_parcial: 'marca-bajo',
  atendida:         '',
  anulada:          'marca-agotado',
};
