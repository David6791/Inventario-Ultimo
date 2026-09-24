/** Un problema encontrado en el archivo, ubicado por fila y columna. */
export interface ErrorImportacion {
  fila: number;
  columna: string;
  mensaje: string;
}

/** Una fila que sí va a entrar, para la vista previa. */
export interface FilaMuestra {
  fila: number;
  codigo: string;
  nombre: string;
  categoria: string;
  accion: 'nuevo' | 'actualiza';
}

export interface RevisionImportacion {
  validos: number;
  nuevos: number;
  actualizados: number;
  errores: ErrorImportacion[];
  muestra: FilaMuestra[];
  mensaje?: string;
}

export interface ResultadoImportacion {
  creados: number;
  actualizados: number;
  mensaje: string;
}
