export interface Categoria {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  productos?: number;
}

export interface UnidadMedida {
  id: number;
  codigo: string;
  nombre: string;
  permite_decimales: boolean;
  activo: boolean;
  productos?: number;
}

export interface AlmacenCatalogo {
  id: number;
  codigo: string;
  nombre: string;
  ubicacion: string | null;
  responsable: string | null;
  activo: boolean;
  usuarios?: number;
}

export interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria_id: number;
  unidad_medida_id: number;
  categoria?: string;
  unidad?: string;
  permite_decimales?: boolean;
  partida_presupuestaria: string | null;
  codigo_barras: string | null;
  stock_minimo: number;
  stock_maximo: number | null;
  controla_lote: boolean;
  controla_vencimiento: boolean;
  activo: boolean;
}

/** Resultado liviano del buscador que usan ingresos y salidas. */
export interface ProductoBuscado {
  id: number;
  codigo: string;
  nombre: string;
  unidad: string;
  permite_decimales: boolean;
  controla_lote: boolean;
  controla_vencimiento: boolean;

  /** Saldo en el almacén activo. Lo usa la solicitud de material para no
   *  dejar pedir más de lo que hay. */
  disponible: number;
}

/**
 * Lo que se ENVÍA al crear o actualizar un producto.
 *
 * Distinto de `Producto`, que es lo que se recibe: acá los identificadores
 * pueden venir en null (el desplegable todavía sin elegir) y no existen los
 * campos que el backend calcula, como `categoria` y `unidad` en texto plano.
 */
export interface ProductoPayload {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria_id: number | null;
  unidad_medida_id: number | null;
  partida_presupuestaria: string | null;
  codigo_barras: string | null;
  stock_minimo: number;
  stock_maximo: number | null;
  controla_lote: boolean;
  controla_vencimiento: boolean;
  activo: boolean;
}
