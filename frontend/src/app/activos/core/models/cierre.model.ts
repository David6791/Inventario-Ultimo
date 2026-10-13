export type EstadoCierre = 'ABIERTO' | 'CALCULADO' | 'CERRADO' | 'ANULADO';

export interface Cierre {
  id: number;
  periodo: string;
  etiqueta: string;
  estado: EstadoCierre;
  ufv_inicial: number;
  ufv_final: number;
  factor: number;
  variacion_porcentual: number;
  activos_procesados: number | null;
  total_actualizacion: number;
  total_dep_financiera: number;
  total_dep_fiscal: number;
  total_no_deducible: number;
  comprobante_contable: string | null;
  trazabilidad?: {
    calculado_por: number | null;
    calculado_at: string | null;
    cerrado_por: number | null;
    cerrado_at: string | null;
  };
}

/** Una fila del auxiliar: es lo que concilia con el mayor contable. */
export interface FilaValuacion {
  activo_id: number;
  codigo: string;
  denominacion: string;
  valor_base_inicial: number;
  actualizacion: number;
  incremento_mejora: number;
  ajuste_limite: number;
  valor_base_final: number;
  dep_acum_inicial: number;
  dep_actualizacion: number;
  dep_periodo: number;
  dep_acum_final: number;
  valor_neto: number;
  meses_depreciados: number;
  vida_util_meses: number | null;
}

export interface FilaConciliacion {
  codigo: string;
  denominacion: string;
  dep_financiera: number;
  dep_impositiva: number;
  no_deducible: number;
  dep_deducible: number;
  diferencia: number;
}

export interface ResumenConciliacion {
  dep_financiera: number;
  dep_deducible: number;
  no_deducible: number;
  diferencia: number;
}

export type SeveridadTag =
  'success' | 'info' | 'secondary' | 'contrast' | 'warning' | 'danger';

export const ESTADOS_CIERRE: {
  valor: EstadoCierre; etiqueta: string; severidad: SeveridadTag; ayuda: string;
}[] = [
  {
    valor: 'ABIERTO', etiqueta: 'Abierto', severidad: 'secondary',
    ayuda: 'Período creado con su UFV. Todavía no se calculó nada.',
  },
  {
    valor: 'CALCULADO', etiqueta: 'Calculado', severidad: 'info',
    ayuda: 'Las valuaciones están hechas pero no son definitivas: se puede recalcular las veces que haga falta.',
  },
  {
    valor: 'CERRADO', etiqueta: 'Cerrado', severidad: 'success',
    ayuda: 'Valores definitivos. El período siguiente parte de acá y este ya no se modifica.',
  },
  {
    valor: 'ANULADO', etiqueta: 'Anulado', severidad: 'danger',
    ayuda: 'Período anulado.',
  },
];

export function etiquetaEstadoCierre(e: string): string {
  return ESTADOS_CIERRE.find((x) => x.valor === e)?.etiqueta ?? e;
}

export function severidadEstadoCierre(e: string): SeveridadTag {
  return ESTADOS_CIERRE.find((x) => x.valor === e)?.severidad ?? 'secondary';
}

export function ayudaEstadoCierre(e: string): string {
  return ESTADOS_CIERRE.find((x) => x.valor === e)?.ayuda ?? '';
}
