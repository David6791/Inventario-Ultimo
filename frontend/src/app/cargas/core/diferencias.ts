import { LecturaTicket } from './models/cargas.model';

/**
 * Compara lo leído de las boletas con lo que se va a guardar y arma la lista
 * de diferencias que la persona debe confirmar antes de guardar: otro
 * productor, otra placa, otro chofer, una boleta de otro día, o un ticket
 * exterior que no es del mismo camión.
 */

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const palabras = (t: string | null | undefined) =>
  sinAcentos((t ?? '').toUpperCase()).replace(/[^A-Z0-9Ñ ]/g, ' ').split(/\s+/).filter((p) => p.length > 1);
const placaNormal = (t: string | null | undefined) => (t ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/**
 * Parecido de dos nombres (0–1): palabras en cualquier orden, y una palabra
 * coincide con otra si difiere en 1 letra (2 si es larga), por errores de lectura.
 */
export function parecidoNombres(a: string | null | undefined, b: string | null | undefined): number {
  const pa = palabras(a), pb = [...palabras(b)];
  if (!pa.length || !pb.length) return 0;
  let iguales = 0;
  for (const x of pa) {
    const i = pb.findIndex((y) => distancia(x, y) <= (Math.max(x.length, y.length) >= 7 ? 2 : 1));
    if (i >= 0) { iguales++; pb.splice(i, 1); }
  }
  return iguales / Math.max(pa.length, palabras(b).length);
}

export interface AnotadoPesaje { placa?: string | null; chofer_nombre?: string | null; }

export function diferenciasBoleta(
  interior: LecturaTicket | null, exterior: LecturaTicket | null, anotado: AnotadoPesaje, productor: string | null,
): string[] {
  const d: string[] = [];
  const ci = interior?.campos ?? {}, ce = exterior?.campos ?? {};
  const valor = (x: unknown) => (x === null || x === undefined ? null : String(x));

  const prodLeido = valor(ci.productor?.valor) ?? valor(ce.productor?.valor);
  if (prodLeido && productor && parecidoNombres(prodLeido, productor) < 0.6) {
    d.push(`La boleta dice productor «${prodLeido}» y el lote es de «${productor}».`);
  }
  const placaLeida = valor(ci.placa?.valor);
  if (placaLeida && anotado.placa && placaNormal(placaLeida) !== placaNormal(anotado.placa)) {
    d.push(`La boleta dice placa ${placaLeida} y se anotó ${anotado.placa}.`);
  }
  const choferLeido = valor(ci.chofer?.valor) ?? valor(ce.chofer?.valor);
  if (choferLeido && anotado.chofer_nombre && parecidoNombres(choferLeido, anotado.chofer_nombre) < 0.5) {
    d.push(`La boleta dice chofer «${choferLeido}» y se anotó «${anotado.chofer_nombre}» (es quien cobra el bono).`);
  }
  const fecha = interior?.fecha_ticket ?? null;
  if (fecha) {
    const horas = (Date.now() - new Date(fecha.replace(' ', 'T')).getTime()) / 3_600_000;
    if (horas > 36) d.push(`La boleta es del ${fecha.slice(0, 10).split('-').reverse().join('/')}: no es de hoy.`);
    if (horas < -2) d.push(`La fecha de la boleta (${fecha.slice(0, 16)}) es posterior a ahora: revísela.`);
  }
  // Los dos tickets deben ser del mismo camión.
  const placaExt = valor(ce.placa?.valor);
  if (placaLeida && placaExt && placaNormal(placaLeida) !== placaNormal(placaExt)) {
    d.push(`El ticket interior es de la placa ${placaLeida} y el exterior de la ${placaExt}.`);
  }
  const prodExt = valor(ce.productor?.valor), prodInt = valor(ci.productor?.valor);
  if (prodInt && prodExt && parecidoNombres(prodInt, prodExt) < 0.6) {
    d.push(`El ticket interior es de «${prodInt}» y el exterior de «${prodExt}».`);
  }
  return d;
}
