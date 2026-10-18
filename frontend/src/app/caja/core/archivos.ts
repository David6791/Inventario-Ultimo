/** Abre un PDF recibido como blob en una pestaña nueva. */
export function abrirPdf(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Descarga un archivo recibido como blob con el nombre indicado. */
export function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Fecha local de hoy en formato AAAA-MM-DD (no la de UTC). */
export function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Nombre del usuario cuando Laravel serializa la relación; vacío si llegó solo el id. */
export function nombreDe(u: { name: string } | number | null | undefined): string {
  return u && typeof u === 'object' ? u.name : '';
}
