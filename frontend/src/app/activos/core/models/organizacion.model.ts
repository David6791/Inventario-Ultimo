export interface Area {
  id: number;
  codigo: string;
  nombre: string;
  activo: boolean;
  centros_count?: number;
}

export interface CentroCosto {
  id: number;
  codigo: string;
  nombre: string;
  etiqueta: string;
  area_id: number;
  area: string | null;
  almacen_id: number | null;
  almacen: string | null;
  responsable_id: number | null;
  empleados_count?: number;
  activos_count?: number;
  /** Sin almacén el centro es invisible: nadie ve sus activos. */
  sin_ambito: boolean;
  activo: boolean;
  /** Recibe carga de mineral (recepción y bonos). */
  es_acopio?: boolean;
  /** Sede central: envía el dinero a las cajas de los acopios. */
  es_central?: boolean;
  /** Cajas del almacén del centro. */
  cajas?: string[];
}

export interface Empleado {
  id: number;
  codigo: string;
  nombres: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  nombre_completo: string;
  ci: string;
  expedido: string | null;
  cargo: string | null;
  profesion: string | null;
  centro_costo_id: number;
  centro: string | null;
  centro_codigo: string | null;
  area: string | null;
  fecha_ingreso: string | null;
  fecha_baja: string | null;
  telefono: string | null;
  movil: string | null;
  email: string | null;
  user_id: number | null;
  /** Tiene cuenta en el sistema. La mayoría del personal no. */
  tiene_acceso: boolean;
  activo: boolean;
  bienes_a_cargo?: number;
}

export interface Almacen {
  id: number;
  codigo: string;
  nombre: string;
}

/** Quien puede recibir bienes: es un empleado, no un usuario del sistema. */
export interface Custodio {
  id: number;
  codigo: string;
  nombre: string;
  etiqueta: string;
  ci: string;
  cargo: string | null;
  centro_costo_id: number;
  centro: string | null;
  tiene_acceso: boolean;
}

export interface FilaPersonal {
  numero: number;
  codigo: string;
  nombres: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  ci: string;
  cargo: string | null;
  area: string;
  centro_costo: string;
  errores: string[];
  valida: boolean;
  existe: boolean;
}

export interface ResumenImportacion {
  total: number;
  validas: number;
  con_error: number;
  nuevos: number;
  existentes: number;
  areas: string[];
  centros: string[];
  importable: boolean;
}
