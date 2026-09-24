export type EstadoDocumento = 'borrador' | 'confirmada' | 'anulada';

export interface SalidaDetalle {
  id?: number;
  producto_id: number;
  codigo?: string | null;
  producto?: string | null;
  unidad?: string | null;
  cantidad: number;
  costo_unitario?: number;
  observacion: string | null;

  /** Solo en el formulario: tope que impone la existencia. */
  disponible?: number;
  permite_decimales?: boolean;
}

/** Lo que devuelve el servidor. */
export interface Salida {
  id: number;
  numero: string;
  fecha: string;

  almacen_id: number;
  almacen?: string;

  /*
   | El documento guarda las dos cosas.
   |
   | El TEXTO es la foto del momento en que se firmó: si mañana renombran la
   | unidad o la persona cambia de área, la nota tiene que seguir diciendo lo
   | que decía. Es lo que se muestra en pantalla y en el PDF.
   |
   | Los IDENTIFICADORES sirven para precargar el formulario al editar y para
   | agrupar en los reportes de consumo por unidad.
   */
  unidad_solicitante: string;
  solicitante: string;
  recibido_por: string;

  unidad_solicitante_id: number | null;
  solicitante_id: number | null;
  recibido_por_id: number | null;

  centro_costo: string | null;
  destino: string | null;
  motivo: string | null;

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

  detalles?: SalidaDetalle[];
  lineas?: number;
  creado_en?: string;
}

/**
 * Lo que se ENVÍA. Solo identificadores: el texto lo resuelve el servidor desde
 * el catálogo, así no puede llegar un nombre que no corresponde al id.
 */
export interface SalidaPayload {
  fecha: string;
  unidad_solicitante_id: number;
  solicitante_id: number;
  recibido_por_id: number;
  centro_costo: string | null;
  destino: string | null;
  motivo: string | null;
  detalles: Array<{
    producto_id: number;
    cantidad: number;
    observacion: string | null;
  }>;
}

export interface FiltroSalidas {
  estado?: EstadoDocumento;
  sin_respaldo?: boolean;
  buscar?: string;
  desde?: string;
  hasta?: string;
}

/** Color de la marca en el borde de la fila, por estado. */
export const MARCA_SALIDA: Record<EstadoDocumento, string> = {
  borrador:   'marca-inactivo',
  confirmada: '',
  anulada:    'marca-agotado',
};
