export type TipoReporte =
  | 'existencias'
  | 'valorizado'
  | 'movimientos'
  | 'vencimientos'
  | 'consumo-areas'
  | 'consumo-solicitantes'
  | 'consumo-productos';

export type TipoColumna = 'texto' | 'cantidad' | 'moneda' | 'fecha' | 'entero';

export interface ColumnaReporte {
  clave: string;
  titulo: string;
  tipo?: TipoColumna;
  ancho?: string;
}

/** Una fila es un objeto plano con las claves que declaran las columnas. */
export type FilaReporte = Record<string, string | number | null>;

export interface ResultadoReporte {
  titulo: string;
  columnas: ColumnaReporte[];
  filas: FilaReporte[];
  totales: Record<string, number>;
  filtros: Record<string, string>;
  mensaje_vacio: string;
  generado_en: string;
}

/** Los filtros que acepta cada reporte. El componente muestra los que aplican. */
export interface FiltroReporte {
  almacen_id?: number | null;
  categoria_id?: number | null;
  estado?: string | null;
  desde?: string | null;
  hasta?: string | null;
  tipo?: string | null;
  producto_id?: number | null;
  dias?: number | null;
  incluir_sin_saldo?: boolean;
}

/** Qué filtros muestra cada reporte y cómo se presenta. */
export interface ConfigReporte {
  titulo: string;
  descripcion: string;
  icono: string;
  permiso: string;
  filtros: Array<'almacen' | 'categoria' | 'estado' | 'fechas' | 'tipo' | 'producto' | 'dias' | 'sin_saldo'>;
}

export const REPORTES: Record<TipoReporte, ConfigReporte> = {
  existencias: {
    titulo: 'Existencias',
    descripcion: 'Qué hay en el almacén, sin precios. Sirve para el recuento físico.',
    icono: 'pi pi-list',
    permiso: 'reportes.existencias',
    filtros: ['almacen', 'categoria', 'estado', 'sin_saldo'],
  },
  valorizado: {
    titulo: 'Inventario valorizado',
    descripcion: 'Cuánto vale el inventario, calculado desde las capas de costo PEPS.',
    icono: 'pi pi-dollar',
    permiso: 'reportes.valorizado',
    filtros: ['almacen', 'categoria'],
  },
  movimientos: {
    titulo: 'Movimientos',
    descripcion: 'Todo lo que entró y salió en un período, con su documento de respaldo.',
    icono: 'pi pi-calendar',
    permiso: 'reportes.movimientos',
    filtros: ['almacen', 'fechas', 'tipo', 'producto'],
  },
  vencimientos: {
    titulo: 'Vencimientos',
    descripcion: 'Material próximo a vencer o ya vencido. Los vencidos aparecen primero.',
    icono: 'pi pi-clock',
    permiso: 'reportes.vencimientos',
    filtros: ['almacen', 'dias'],
  },
    'consumo-areas': {
    titulo: 'Consumo por área',
    descripcion: 'Cuánto consumió cada unidad en el período, al costo real de las capas '
               + 'que salieron. Neto de devoluciones.',
    icono: 'pi pi-chart-bar',
    permiso: 'reportes.consumo',
    filtros: ['almacen', 'fechas'],
  },
  'consumo-solicitantes': {
    titulo: 'Consumo por solicitante',
    descripcion: 'El mismo consumo abierto por persona. Responde por qué subió el gasto '
               + 'de una unidad.',
    icono: 'pi pi-user',
    permiso: 'reportes.consumo',
    filtros: ['almacen', 'fechas'],
  },
  'consumo-productos': {
    titulo: 'Consumo por producto',
    descripcion: 'Qué ítems concentran el gasto y en cuántas áreas se consumieron.',
    icono: 'pi pi-box',
    permiso: 'reportes.consumo',
    filtros: ['almacen', 'fechas'],
  },
};
