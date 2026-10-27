/**
 * Utilidades de imagen para las fotos de la recepción, todo en el navegador:
 * abrir la foto de la cámara (reducida), ubicar las cuatro esquinas del ticket
 * y enderezarlo (corrección de perspectiva) a la proporción de la plantilla,
 * para que cada dato quede siempre en el mismo recuadro.
 */

export interface Punto { x: number; y: number; }
/** Esquinas del ticket: superior izquierda, superior derecha, inferior derecha, inferior izquierda. */
export type Esquinas = [Punto, Punto, Punto, Punto];

/** Ancho del ticket enderezado que se sube (el servidor lo normaliza igual). */
export const ANCHO_ENDEREZADO = 1400;

/** Abre la foto (respetando la orientación de la cámara) en un canvas de lado mayor `maximo`. */
export async function abrirFoto(archivo: Blob, maximo = 2200): Promise<HTMLCanvasElement> {
  let fuente: ImageBitmap | HTMLImageElement;
  try {
    fuente = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    fuente = await new Promise<HTMLImageElement>((ok, mal) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => mal(new Error('No se pudo abrir la foto.'));
      img.src = URL.createObjectURL(archivo);
    });
  }
  const w = fuente.width, h = fuente.height;
  const escala = Math.min(1, maximo / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * escala);
  c.height = Math.round(h * escala);
  c.getContext('2d')!.drawImage(fuente, 0, 0, c.width, c.height);
  if ('close' in fuente) fuente.close();
  return c;
}

export function aBlob(c: HTMLCanvasElement, calidad = 0.88): Promise<Blob> {
  return new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo preparar la foto.'))), 'image/jpeg', calidad));
}

/** Esquinas a un 8 % del borde (cuando no se detecta el ticket). */
export function esquinasPorDefecto(w: number, h: number): Esquinas {
  const mx = w * 0.08, my = h * 0.08;
  return [{ x: mx, y: my }, { x: w - mx, y: my }, { x: w - mx, y: h - my }, { x: mx, y: h - my }];
}

/**
 * Busca el ticket: el papel claro sobre un fondo más oscuro. Se reduce la
 * foto, se binariza con Otsu, se toma la mancha clara más grande que no toque
 * todo el borde, y sus puntos extremos (mín. x+y, máx. x−y, máx. x+y, mín. x−y)
 * son las esquinas. Si no hay una mancha razonable, esquinas por defecto.
 */
export function detectarEsquinas(c: HTMLCanvasElement): Esquinas {
  const W = c.width, H = c.height;
  const escala = Math.min(1, 320 / Math.max(W, H));
  const w = Math.max(8, Math.round(W * escala)), h = Math.max(8, Math.round(H * escala));
  const chico = document.createElement('canvas');
  chico.width = w; chico.height = h;
  const ctx = chico.getContext('2d')!;
  ctx.drawImage(c, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;

  const gris = new Uint8Array(w * h);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < w * h; i++) {
    const g = (px[i * 4] * 299 + px[i * 4 + 1] * 587 + px[i * 4 + 2] * 114) / 1000 | 0;
    gris[i] = g; hist[g]++;
  }
  const umbral = otsu(hist, w * h);

  // Mancha clara más grande (4-vecinos).
  const marca = new Int32Array(w * h).fill(-1);
  let mejor = -1, mejorArea = 0;
  const pila: number[] = [];
  let etiqueta = 0;
  for (let i = 0; i < w * h; i++) {
    if (marca[i] !== -1 || gris[i] <= umbral) continue;
    let area = 0;
    pila.push(i); marca[i] = etiqueta;
    while (pila.length) {
      const k = pila.pop()!; area++;
      const x = k % w, y = (k / w) | 0;
      const vecinos = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1];
      for (const v of vecinos) if (v >= 0 && marca[v] === -1 && gris[v] > umbral) { marca[v] = etiqueta; pila.push(v); }
    }
    if (area > mejorArea) { mejorArea = area; mejor = etiqueta; }
    etiqueta++;
  }
  if (mejor < 0 || mejorArea < w * h * 0.12 || mejorArea > w * h * 0.97) return esquinasPorDefecto(W, H);

  let tl = { x: 0, y: 0, v: Infinity }, tr = { x: 0, y: 0, v: -Infinity }, br = { x: 0, y: 0, v: -Infinity }, bl = { x: 0, y: 0, v: Infinity };
  for (let i = 0; i < w * h; i++) {
    if (marca[i] !== mejor) continue;
    const x = i % w, y = (i / w) | 0;
    if (x + y < tl.v) tl = { x, y, v: x + y };
    if (x - y > tr.v) tr = { x, y, v: x - y };
    if (x + y > br.v) br = { x, y, v: x + y };
    if (x - y < bl.v) bl = { x, y, v: x - y };
  }
  const k = 1 / escala;
  const e: Esquinas = [{ x: tl.x * k, y: tl.y * k }, { x: tr.x * k, y: tr.y * k }, { x: br.x * k, y: br.y * k }, { x: bl.x * k, y: bl.y * k }];
  // Un cuadrilátero degenerado (todo en una línea) no sirve.
  return areaCuadrilatero(e) < W * H * 0.08 ? esquinasPorDefecto(W, H) : e;
}

function otsu(hist: number[], total: number): number {
  let suma = 0;
  for (let i = 0; i < 256; i++) suma += i * hist[i];
  let sumaB = 0, pesoB = 0, mejor = 0, umbral = 127;
  for (let t = 0; t < 256; t++) {
    pesoB += hist[t];
    if (!pesoB) continue;
    const pesoF = total - pesoB;
    if (!pesoF) break;
    sumaB += t * hist[t];
    const mB = sumaB / pesoB, mF = (suma - sumaB) / pesoF;
    const entre = pesoB * pesoF * (mB - mF) ** 2;
    if (entre > mejor) { mejor = entre; umbral = t; }
  }
  return umbral;
}

export function areaCuadrilatero(e: Esquinas): number {
  let a = 0;
  for (let i = 0; i < 4; i++) { const p = e[i], q = e[(i + 1) % 4]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a) / 2;
}

const dist = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);

/** Ancho/alto del ticket según sus esquinas (promedio de lados opuestos). */
export function proporcionDe(e: Esquinas): number {
  const ancho = (dist(e[0], e[1]) + dist(e[3], e[2])) / 2;
  const alto = (dist(e[0], e[3]) + dist(e[1], e[2])) / 2;
  return alto > 0 ? ancho / alto : 1;
}

/**
 * Homografía que lleva el rectángulo destino (0,0)-(w,h) a las esquinas de la
 * foto: para cada píxel del resultado se sabe de dónde tomarlo.
 */
function homografia(e: Esquinas, w: number, h: number): number[] {
  const destino: Punto[] = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = destino[i], { x: u, y: v } = e[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  return [...resolver(A, b), 1];
}

/** Gauss con pivoteo parcial (sistema 8 × 8). */
function resolver(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((fila, i) => [...fila, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let f = c + 1; f < n; f++) if (Math.abs(M[f][c]) > Math.abs(M[p][c])) p = f;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let f = 0; f < n; f++) {
      if (f === c) continue;
      const k = M[f][c] / d;
      for (let j = c; j <= n; j++) M[f][j] -= k * M[c][j];
    }
  }
  return M.map((fila, i) => fila[n] / (M[i][i] || 1e-12));
}

/** Endereza el ticket a `ancho` × `ancho / proporcion` con interpolación bilineal. */
export function enderezar(c: HTMLCanvasElement, e: Esquinas, proporcion: number, ancho = ANCHO_ENDEREZADO): HTMLCanvasElement {
  const w = ancho, h = Math.max(1, Math.round(ancho / proporcion));
  const H = homografia(e, w, h);
  const sw = c.width, sh = c.height;
  const src = c.getContext('2d')!.getImageData(0, 0, sw, sh).data;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const octx = out.getContext('2d')!;
  const dst = octx.createImageData(w, h);
  const d = dst.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const z = H[6] * x + H[7] * y + H[8];
      const u = (H[0] * x + H[1] * y + H[2]) / z;
      const v = (H[3] * x + H[4] * y + H[5]) / z;
      const o = (y * w + x) * 4;
      if (u < 0 || v < 0 || u >= sw - 1 || v >= sh - 1) { d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = 255; continue; }
      const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      for (let k = 0; k < 3; k++) {
        const a = src[i00 + k] * (1 - fx) + src[i10 + k] * fx;
        const bb = src[i01 + k] * (1 - fx) + src[i11 + k] * fx;
        d[o + k] = a * (1 - fy) + bb * fy;
      }
      d[o + 3] = 255;
    }
  }
  octx.putImageData(dst, 0, 0);
  return out;
}

/** Copia reducida (para la foto original que se guarda de respaldo). */
export function reducir(c: HTMLCanvasElement, maximo: number): HTMLCanvasElement {
  const escala = Math.min(1, maximo / Math.max(c.width, c.height));
  if (escala === 1) return c;
  const r = document.createElement('canvas');
  r.width = Math.round(c.width * escala); r.height = Math.round(c.height * escala);
  r.getContext('2d')!.drawImage(c, 0, 0, r.width, r.height);
  return r;
}
