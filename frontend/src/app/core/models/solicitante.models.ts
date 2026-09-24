export interface UnidadSolicitante {
  id: number;
  codigo: string;
  nombre: string;
  responsable: string | null;
  centro_costo: string | null;
  activo: boolean;
  solicitantes?: number;
}

export interface Solicitante {
  id: number;
  unidad_solicitante_id: number;
  unidad?: string;
  centro_costo?: string | null;

  nombre: string;
  ci: string | null;
  cargo: string | null;
  telefono: string | null;

  /** Puede retirar material, además de solicitarlo. */
  autorizado_retirar: boolean;
  activo: boolean;
}
