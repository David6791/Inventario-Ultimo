export type Urgencia = 'alta' | 'media' | 'normal' | 'baja';

/** Algo que requiere acción. Lleva su ruta para poder ir a resolverlo. */
export interface Pendiente {
  clave: string;
  titulo: string;
  cantidad: number;
  descripcion: string;
  accion: string | null;
  ruta: string | null;
  urgencia: Urgencia;
  icono: string;
}

export interface Alerta {
  clave: string;
  titulo: string;
  cantidad: number;
  descripcion: string;
  ruta: string;
  urgencia: Urgencia;
  icono: string;
}

export interface Cifra {
  clave: string;
  rotulo: string;
  valor: number;
  tipo: 'entero' | 'moneda';
}

export interface MovimientoReciente {
  id: number;
  fecha: string;
  documento: string;
  tipo: string;
  es_anulacion: boolean;
  producto: string | null;
  codigo: string | null;
  entrada: number;
  salida: number;
  usuario: string | null;
}

export interface Tablero {
  almacen_id: number;
  pendientes: Pendiente[];
  alertas: Alerta[];
  cifras: Cifra[];
  reciente: MovimientoReciente[];
  generado_en: string;
}
