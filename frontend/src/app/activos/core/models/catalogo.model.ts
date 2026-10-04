export interface Clase {
  id: number;
  codigo: string;
  nombre: string;
  deprecia: boolean;
  vida_util_fiscal_meses: number | null;
  coeficiente_fiscal: string | null;
  cuenta_activo: string | null;
  cuenta_dep_acumulada: string | null;
  cuenta_gasto_dep: string | null;
  es_bien_control: boolean;
  activo: boolean;
  subclases_count?: number;
}

export interface Subclase {
  id: number;
  clase_id: number;
  codigo: string;
  nombre: string;
  vida_util_economica_meses: number | null;
  activo: boolean;
  clase?: Pick<Clase, 'id' | 'codigo' | 'nombre'>;
}

export interface Ubicacion {
  id: number;
  codigo: string;
  nombre: string;
  unidad_org_id: number | null;
  sucursal: string | null;
  direccion: string | null;
  ambiente: string | null;
  padre_id: number | null;
  activo: boolean;
  ruta?: string;
}

export type TipoDato = 'texto' | 'numero' | 'fecha' | 'booleano';

export interface Parametro {
  id: number;
  clave: string;
  valor: string;
  tipo_dato: TipoDato;
  descripcion: string | null;
  vigente_desde: string;
  vigente_hasta?: string | null;
}

export interface RespuestaApi<T> {
  data: T;
  mensaje?: string;
}
