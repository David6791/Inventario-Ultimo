export type TipoDocumento =
  'ASIGNACION' | 'TRASPASO' | 'SALIDA_TEMPORAL' | 'DEVOLUCION' | 'BAJA';

export type EstadoDocumento = 'BORRADOR' | 'CONFIRMADO' | 'ANULADO';

export interface ActivoDelDocumento {
  id: number;
  codigo: string;
  denominacion: string;
  serie: string | null;
  estado_al_emitir: string;
  condicion_al_emitir: string;
  observacion: string | null;
}

export interface Documento {
  id: number;
  tipo: TipoDocumento;
  numero: string;
  gestion: number;
  fecha: string;
  estado: EstadoDocumento;
  motivo: string | null;
  observaciones: string | null;

  custodio_origen_id: number | null;
  custodio_destino_id: number | null;
  ubicacion_destino_id: number | null;
  centro_costo_destino_id: number | null;

  salida?: {
    destino: string | null;
    retorno_comprometido: string | null;
    retorno_real: string | null;
    vencido: boolean;
  };

  activos?: ActivoDelDocumento[];
  cantidad_activos?: number;

  trazabilidad: {
    creado_por: number | null;
    creado_at: string | null;
    confirmado_por: number | null;
    confirmado_at: string | null;
    anulado_por: number | null;
    anulado_at: string | null;
    motivo_anulacion: string | null;
  };
}

export interface FiltrosDocumento {
  tipo?: TipoDocumento;
  estado?: EstadoDocumento;
  custodio_id?: number;
  solo_vencidos?: boolean;
  buscar?: string;
  page?: number;
  por_pagina?: number;
}

export interface BienDeCustodio {
  id: number;
  codigo: string;
  denominacion: string;
  serie: string | null;
  clase: string | null;
  ubicacion: string | null;
  estado: string;
  condicion: string;
  valor_origen: number;
}

export type SeveridadTag =
  'success' | 'info' | 'secondary' | 'contrast' | 'warning' | 'danger';

export const TIPOS_DOCUMENTO: {
  valor: TipoDocumento; etiqueta: string; icono: string; descripcion: string;
}[] = [
  {
    valor: 'ASIGNACION', etiqueta: 'Asignación', icono: 'pi pi-user-plus',
    descripcion: 'Entrega un bien sin custodio a un responsable.',
  },
  {
    valor: 'TRASPASO', etiqueta: 'Traspaso', icono: 'pi pi-arrow-right-arrow-left',
    descripcion: 'Cambia el custodio, la ubicación o el centro de costo de un bien ya asignado.',
  },
  {
    valor: 'SALIDA_TEMPORAL', etiqueta: 'Salida temporal', icono: 'pi pi-sign-out',
    descripcion: 'Autoriza sacar un bien de las instalaciones con fecha de retorno comprometida.',
  },
  {
    valor: 'DEVOLUCION', etiqueta: 'Devolución', icono: 'pi pi-undo',
    descripcion: 'Libera al custodio. Es el paso previo al descargo por desvinculación.',
  },
];

export const ESTADOS_DOCUMENTO: {
  valor: EstadoDocumento; etiqueta: string; severidad: SeveridadTag;
}[] = [
  { valor: 'BORRADOR',   etiqueta: 'Borrador',   severidad: 'secondary' },
  { valor: 'CONFIRMADO', etiqueta: 'Confirmado', severidad: 'success' },
  { valor: 'ANULADO',    etiqueta: 'Anulado',    severidad: 'danger' },
];

export function etiquetaTipo(tipo: string): string {
  return TIPOS_DOCUMENTO.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
}

export function etiquetaEstadoDoc(estado: string): string {
  return ESTADOS_DOCUMENTO.find((e) => e.valor === estado)?.etiqueta ?? estado;
}

export function severidadEstadoDoc(estado: string): SeveridadTag {
  return ESTADOS_DOCUMENTO.find((e) => e.valor === estado)?.severidad ?? 'secondary';
}
