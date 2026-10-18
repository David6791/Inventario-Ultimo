import { Pipe, PipeTransform } from '@angular/core';

const FORMATO = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1250.5 → «1.250,50», como en los comprobantes bolivianos. */
export function formatoDinero(monto: string | number | null | undefined): string {
  if (monto === null || monto === undefined || monto === '') return '—';
  return FORMATO.format(Number(monto));
}

export function simbolo(moneda: string): string {
  return moneda === 'USD' ? 'US$' : 'Bs';
}

@Pipe({ name: 'dinero', standalone: true })
export class DineroPipe implements PipeTransform {
  /** {{ monto | dinero }} o {{ monto | dinero:'USD' }} para anteponer el símbolo. */
  transform(monto: string | number | null | undefined, moneda?: string): string {
    const texto = formatoDinero(monto);
    return moneda && texto !== '—' ? `${simbolo(moneda)} ${texto}` : texto;
  }
}
