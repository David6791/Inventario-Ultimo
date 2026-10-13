export type TipoFoto =
  | 'IDENTIFICACION' | 'ESTADO' | 'SERIE'
  | 'ENTREGA' | 'DEVOLUCION' | 'TOMA_FISICA' | 'BAJA';

export interface Foto {
  id: number;
  url: string;
  url_miniatura: string;
  tipo: TipoFoto;
  etiqueta_tipo: string;
  descripcion: string | null;
  es_principal: boolean;
  tamanio_kb: number | null;
  created_at: string;
}

export const TIPOS_FOTO: { valor: TipoFoto; etiqueta: string; ayuda: string }[] = [
  {
    valor: 'IDENTIFICACION', etiqueta: 'Identificación',
    ayuda: 'Cómo se ve el bien. Es la que confirma que la etiqueta corresponde.',
  },
  {
    valor: 'ESTADO', etiqueta: 'Estado',
    ayuda: 'Golpes, desgaste o deterioro en un momento dado.',
  },
  {
    valor: 'SERIE', etiqueta: 'Serie o placa',
    ayuda: 'El número legible, para verificarlo sin desarmar nada.',
  },
  {
    valor: 'ENTREGA', etiqueta: 'Entrega',
    ayuda: 'Cómo estaba al entregarse al custodio.',
  },
  {
    valor: 'DEVOLUCION', etiqueta: 'Devolución',
    ayuda: 'Cómo volvió. Comparada con la de entrega, es la prueba de un reclamo.',
  },
  {
    valor: 'TOMA_FISICA', etiqueta: 'Toma física',
    ayuda: 'Hallazgo durante un inventario.',
  },
  {
    valor: 'BAJA', etiqueta: 'Baja',
    ayuda: 'Respaldo del deterioro que justifica la disposición.',
  },
];
