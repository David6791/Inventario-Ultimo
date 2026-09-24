export interface Rol {
  id: number;
  name: string;
  descripcion: string | null;
  es_sistema: boolean;
  usuarios?: number;
  permisos?: string[];
  puede_editarse: boolean;
  puede_eliminarse: boolean;
  creado_en?: string;
}

export interface AlmacenAsignado {
  id: number;
  codigo: string;
  nombre: string;
  es_predeterminado: boolean;
}

export interface Almacen {
  id: number;
  codigo: string;
  nombre: string;
  ubicacion: string | null;
}

export interface Usuario {
  id: number;
  ci: string | null;
  name: string;
  email: string;
  cargo: string | null;
  telefono: string | null;
  activo: boolean;
  debe_cambiar_clave: boolean;
  ultimo_acceso_en: string | null;
  roles?: { id: number; name: string }[];
  almacenes?: AlmacenAsignado[];
}

/** Respuesta de /api/me y /api/login. Es de lo único que vive el frontend. */
export interface Perfil {
  usuario: Usuario;
  roles: string[];
  permisos: string[];
  almacenes: AlmacenAsignado[];
  debe_cambiar_clave: boolean;
}

export interface RespuestaLogin {
  token: string;
  usuario: Perfil;
}

export interface PermisoCatalogo {
  nombre: string;
  descripcion: string;
}

export interface ModuloPermisos {
  clave: string;
  etiqueta: string;
  icono: string;
  permisos: PermisoCatalogo[];
}

export interface Paginado<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}
