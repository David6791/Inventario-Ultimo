/** Respuestas y entidades del módulo de manejo de cargas (api/cargas). */

export interface RespuestaApi<T> {
  data: T;
  mensaje?: string;
}

export interface Pagina<T> {
  data: T[];
  current_page: number;
  per_page: number;
  total: number;
}

export interface Opcion {
  valor: string;
  etiqueta: string;
}

export interface Opciones {
  tipos_productor: Opcion[];
  departamentos: Opcion[];
  unidades_ley: Opcion[];
  unidades_cotizacion: Opcion[];
  formas: Opcion[];
  modalidades_precio: Opcion[];
  roles_elemento: Opcion[];
  origenes: Opcion[];
  reinicios: Opcion[];
  marcadores: Opcion[];
}

export type TipoProductor = 'COOPERATIVISTA' | 'PARTICULAR' | 'EMPRESA' | 'INGENIO';

export interface Referencia {
  id: number;
  nombre: string;
}

export interface Productor {
  id: number;
  tipo: TipoProductor;
  nombre: string;
  ci: string | null;
  nit: string | null;
  nim: string | null;
  telefono: string | null;
  domicilio: string | null;
  cooperativa_id: number | null;
  cooperativa?: Referencia | null;
  activo: boolean;
}

export interface Municipio {
  id: number;
  codigo: string | null;
  nombre: string;
  departamento: string;
  cooperativas_count?: number;
  minas_count?: number;
}

export interface Cooperativa {
  id: number;
  nombre: string;
  sigla: string | null;
  nit: string | null;
  nim: string | null;
  municipio_id: number | null;
  municipio?: Referencia | null;
  activa: boolean;
  productores_activos?: number;
  minas_activas?: number;
}

export interface Mina {
  id: number;
  nombre: string;
  propia: boolean;
  cooperativa_id: number | null;
  cooperativa?: Referencia | null;
  municipio_id: number | null;
  municipio?: Referencia | null;
  activa: boolean;
  bocaminas_activas?: number;
}

export interface Bocamina {
  id: number;
  mina_id: number;
  codigo: string;
  nombre: string | null;
  activa: boolean;
}

export interface Laboratorio {
  id: number;
  nombre: string;
  nit: string | null;
  propio: boolean;
  acreditado: boolean;
  activo: boolean;
}

export interface Banco {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Elemento {
  id: number;
  codigo: string;
  nombre: string;
  unidad_ley: string;
  unidad_cotizacion: string | null;
  activo: boolean;
  /** Con análisis, leyes, precios o cotizaciones: la unidad ya no cambia. */
  unidad_fija?: boolean;
}

export type RolElemento = 'PAGABLE' | 'PENALIZABLE' | 'INFORMATIVO';

export interface LineaElemento {
  id?: number;
  elemento_id: number;
  rol: RolElemento;
  split_limit: number | null;
  elemento?: Pick<Elemento, 'id' | 'codigo' | 'nombre' | 'unidad_ley'>;
}

export interface LineaProducto {
  id: number;
  codigo: string;
  nombre: string;
  forma: string;
  modalidad_precio: string;
  activa: boolean;
  elementos: LineaElemento[];
  series_count?: number;
}

export interface SerieLote {
  id: number;
  prefijo: string;
  nombre: string;
  linea_producto_id: number;
  linea?: { id: number; codigo: string; nombre: string };
  origen: 'COMPRA' | 'PROPIA';
  formato: string;
  reinicio: 'NUNCA' | 'ANUAL' | 'MENSUAL' | 'DIARIO';
  activa: boolean;
  lotes: number;
  ultimo_numero: number;
  proximo_codigo: string | null;
}

export interface VistaPrevia {
  codigo: string | null;
  repetido: boolean;
  error: string | null;
}

export interface EstadoModulo {
  esquemas: { esquema: string; tablas: number; vistas: number }[];
  catalogo: Record<string, number>;
  series: { prefijo: string; formato: string; reinicio: string; proximo_codigo: string }[];
}

// ---------------------------------------------------------------- Importación

export interface ErrorFila {
  fila: number;
  columna: string;
  mensaje: string;
}

export interface RevisionProductores {
  nuevos: number;
  actualizados: number;
  errores: ErrorFila[];
  advertencias: { fila: number; mensaje: string }[];
  cooperativas_nuevas: string[];
  cooperativas_unificadas: { nombre: string; variantes: string[] }[];
  muestra: {
    fila: number;
    nombre: string;
    documento: string;
    tipo: string;
    cooperativa: string | null;
    accion: 'nuevo' | 'actualiza';
  }[];
  message?: string;
}

export interface ResultadoProductores {
  creados: number;
  actualizados: number;
  cooperativas_creadas: number;
  mensaje: string;
}
