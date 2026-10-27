import { Injectable, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';

export interface Escaner { id: string; nombre: string; }
export interface EstadoEscaner { ok: boolean; version: string; escaneres: Escaner[]; error?: string; }

/**
 * Escáner USB de la PC de recepción, a través del agente local
 * (docker-activos/escaner/agente-escaner.ps1, en http://127.0.0.1:9123).
 *
 * Se usa fetch y no HttpClient a propósito: el interceptor de HttpClient
 * agrega el token de la sesión, y el token no tiene por qué salir hacia
 * ningún otro programa, aunque sea local.
 */
@Injectable({ providedIn: 'root' })
export class EscanerService {
  private readonly url = (environment as { escanerUrl?: string }).escanerUrl ?? 'http://127.0.0.1:9123';
  private revisado: Promise<EstadoEscaner | null> | null = null;

  /** Estado del agente; null si no está instalado en esta PC. Se revisa una vez por sesión. */
  readonly estado = signal<EstadoEscaner | null>(null);

  revisar(forzar = false): Promise<EstadoEscaner | null> {
    if (!this.revisado || forzar) {
      this.revisado = this.pedir('/estado', 'GET', 2000)
        .then((r) => (r.ok ? (r.json() as Promise<EstadoEscaner>) : null))
        .catch(() => null)
        .then((e) => { this.estado.set(e); return e; });
    }
    return this.revisado;
  }

  /** Escanea todo el vidrio y devuelve la imagen (JPG). */
  async escanear(dpi = 300, color = true, dispositivo?: string): Promise<Blob> {
    const q = new URLSearchParams({ dpi: String(dpi), color: color ? '1' : '0', ...(dispositivo ? { dispositivo } : {}) });
    let r: Response;
    try {
      r = await this.pedir(`/escanear?${q}`, 'POST', 120_000);
    } catch {
      throw new Error('No se pudo hablar con el agente del escáner. ¿Está instalado y encendido en esta PC?');
    }
    if (!r.ok) {
      const e = await r.json().catch(() => null);
      throw new Error(e?.error ?? `El escáner respondió con error ${r.status}.`);
    }
    return r.blob();
  }

  private pedir(ruta: string, method: 'GET' | 'POST', espera: number): Promise<Response> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), espera);
    // targetAddressSpace: Chrome pregunta una vez si la página puede usar programas de esta PC.
    const opciones = { method, signal: ctl.signal, cache: 'no-store', targetAddressSpace: 'loopback' } as RequestInit;
    return fetch(this.url + ruta, opciones).finally(() => clearTimeout(t));
  }
}
