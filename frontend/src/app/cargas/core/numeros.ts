/** «10,25», «10.25» o vacío → número o null. Sin separador de miles (leyes, precios por punto, porcentajes). */
export function aNumero(v: string | number | null | undefined, decimales = 4): number | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim().replace(',', '.');
  return new RegExp(`^\\d+(\\.\\d{1,${decimales}})?$`).test(t) ? Number(t) : null;
}

/** Texto escrito que no es un número válido (vacío no cuenta como error). */
export function numeroInvalido(v: string | number | null | undefined, decimales = 4): boolean {
  return v !== null && v !== undefined && String(v).trim() !== '' && aNumero(v, decimales) === null;
}

/** Número para mostrar en un campo de texto editable: coma decimal, sin miles. */
export function aTexto(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  return String(Number(v)).replace('.', ',');
}

export function formatoLey(v: string | number | null | undefined, max = 4): string {
  if (v === null || v === undefined || v === '') return '—';
  return Number(v).toLocaleString('es-BO', { maximumFractionDigits: max });
}
