export type EstadoActivo =
  | 'REGISTRADO' | 'EN_USO' | 'EN_REPARACION' | 'OCIOSO'
  | 'EN_TRANSITO' | 'FUERA_DE_INSTALACION' | 'DADO_DE_BAJA';

export type CondicionActivo = 'NUEVO' | 'BUENO' | 'REGULAR' | 'MALO' | 'INSERVIBLE';

export type TipoOrigen =
  | 'COMPRA' | 'IMPORTACION' | 'CONSTRUCCION' | 'DONACION'
  | 'PERMUTA' | 'APORTE' | 'SOBRANTE_INVENTARIO';

export type ConceptoCosto =
  | 'PRECIO' | 'FLETE' | 'SEGURO' | 'TRIBUTOS_IMPORTACION'
  | 'DESADUANIZACION' | 'INSTALACION' | 'MONTAJE' | 'PRUEBAS' | 'OTRO';


export type SeveridadTag =
  'success' | 'info' | 'secondary' | 'contrast' | 'warning' | 'danger';

export interface LineaCosto {
  concepto: ConceptoCosto;
  monto: number;
  documento?: string | null;
  observacion?: string | null;
}

/** Fila del listado. Liviana a propósito: sin costos ni movimientos. */
export interface ActivoLista {
  id: number;
  codigo: string;
  denominacion: string;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  clase?: string;
  subclase?: string;
  ubicacion?: string;
  estado: EstadoActivo;
  condicion: CondicionActivo;
  custodio_id: number | null;
  es_bien_control: boolean;
  valor_origen: number;
  fecha_incorporacion: string;
}

export interface Movimiento {
  tipo: string;
  fecha: string;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  detalle: Record<string, unknown> | null;
  usuario_id: number;
}

/** Ficha completa. */
export interface Activo {
  id: number;
  codigo: string;
  denominacion: string;
  descripcion: string | null;

  clase?: { id: number; codigo: string; nombre: string; deprecia: boolean };
  subclase?: { id: number; codigo: string; nombre: string };

  marca: string | null;
  modelo: string | null;
  serie: string | null;
  chasis: string | null;
  motor: string | null;
  placa: string | null;
  anio_fabricacion: number | null;
  es_bien_control: boolean;

  origen: {
    tipo: TipoOrigen;
    proveedor_id: number | null;
    factura_nro: string | null;
    factura_fecha: string | null;
    acta_recepcion: string | null;
  };

  // Separadas a propósito: la incorporación es contable, el inicio de uso
  // es la base del cómputo de la depreciación.
  fecha_incorporacion: string;
  fecha_inicio_uso: string | null;

  valuacion: {
    moneda: string;
    tipo_cambio: number;
    valor_origen: number;
    valor_residual: number;
    vida_util_fiscal_meses: number | null;
    vida_util_economica_meses: number | null;
    regimen_fiscal: string;
    ds5563_ddjj_presentada: boolean | null;
  };

  situacion: {
    estado: EstadoActivo;
    condicion: CondicionActivo;
    custodio_id: number | null;
    esta_asignado: boolean;
    ubicacion?: { id: number; codigo: string; nombre: string; ruta: string };
    centro_costo_id: number | null;
  };

  costos?: LineaCosto[];
  movimientos?: Movimiento[];
  componentes?: Activo[];
  bien_padre_id: number | null;

  foto_path: string | null;
  observaciones: string | null;
  created_at: string;
}

export interface FiltrosActivo {
  buscar?: string;
  clase_id?: number;
  subclase_id?: number;
  ubicacion_id?: number;
  custodio_id?: number;
  estado?: EstadoActivo;
  solo_capitalizables?: boolean;
  incluir_bajas?: boolean;
  por_pagina?: number;
  page?: number;
}

export interface Paginado<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export interface EtiquetaActivo {
  codigo: string;
  denominacion: string;
  clase: string | null;
  serie: string | null;
}

export const ESTADOS_ACTIVO: { valor: EstadoActivo; etiqueta: string; severidad: SeveridadTag }[] = [
  { valor: 'REGISTRADO',           etiqueta: 'Registrado',       severidad: 'info' },
  { valor: 'EN_USO',               etiqueta: 'En uso',           severidad: 'success' },
  { valor: 'EN_REPARACION',        etiqueta: 'En reparación',    severidad: 'warning' },
  { valor: 'OCIOSO',               etiqueta: 'Ocioso',           severidad: 'warning' },
  { valor: 'EN_TRANSITO',          etiqueta: 'En tránsito',      severidad: 'info' },
  { valor: 'FUERA_DE_INSTALACION', etiqueta: 'Fuera de oficina', severidad: 'warning' },
  { valor: 'DADO_DE_BAJA',         etiqueta: 'Dado de baja',     severidad: 'danger' },
];

export const CONDICIONES: { valor: CondicionActivo; etiqueta: string }[] = [
  { valor: 'NUEVO',      etiqueta: 'Nuevo' },
  { valor: 'BUENO',      etiqueta: 'Bueno' },
  { valor: 'REGULAR',    etiqueta: 'Regular' },
  { valor: 'MALO',       etiqueta: 'Malo' },
  { valor: 'INSERVIBLE', etiqueta: 'Inservible' },
];

export const ORIGENES: { valor: TipoOrigen; etiqueta: string }[] = [
  { valor: 'COMPRA',              etiqueta: 'Compra' },
  { valor: 'IMPORTACION',         etiqueta: 'Importación' },
  { valor: 'CONSTRUCCION',        etiqueta: 'Construcción' },
  { valor: 'DONACION',            etiqueta: 'Donación' },
  { valor: 'PERMUTA',             etiqueta: 'Permuta' },
  { valor: 'APORTE',              etiqueta: 'Aporte de capital' },
  { valor: 'SOBRANTE_INVENTARIO', etiqueta: 'Sobrante de inventario' },
];

export const CONCEPTOS_COSTO: { valor: ConceptoCosto; etiqueta: string }[] = [
  { valor: 'PRECIO',               etiqueta: 'Precio de factura' },
  { valor: 'FLETE',                etiqueta: 'Flete' },
  { valor: 'SEGURO',               etiqueta: 'Seguro de traslado' },
  { valor: 'TRIBUTOS_IMPORTACION', etiqueta: 'Tributos de importación' },
  { valor: 'DESADUANIZACION',      etiqueta: 'Desaduanización' },
  { valor: 'INSTALACION',          etiqueta: 'Instalación' },
  { valor: 'MONTAJE',              etiqueta: 'Montaje' },
  { valor: 'PRUEBAS',              etiqueta: 'Pruebas' },
  { valor: 'OTRO',                 etiqueta: 'Otro' },
];
