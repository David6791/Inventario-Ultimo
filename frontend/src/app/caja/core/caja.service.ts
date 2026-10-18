import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Caja, CajaOperacion, Concepto, DatosCaja, DatosMovimiento, Moneda, Movimiento,
  OpcionesCaja, SaldoSesion, SesionAbierta, VistaPreviaComprobante,
} from './caja.model';

interface Respuesta<T> { data: T; mensaje?: string; }

@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/caja`;

  /** Listas cerradas; se piden una vez por sesión del navegador. */
  readonly opciones$: Observable<OpcionesCaja> = this.http
    .get<Respuesta<OpcionesCaja>>(`${this.base}/opciones`)
    .pipe(map((r) => r.data), shareReplay({ bufferSize: 1, refCount: false }));

  // ------------------------------------------------------------ Cajas
  listar(): Observable<Caja[]> {
    return this.http.get<Respuesta<Caja[]>>(`${this.base}/cajas`).pipe(map((r) => r.data));
  }

  ver(id: number): Observable<CajaOperacion> {
    return this.http.get<Respuesta<CajaOperacion>>(`${this.base}/cajas/${id}`).pipe(map((r) => r.data));
  }

  guardar(datos: DatosCaja, id?: number): Observable<Caja> {
    const pedido = id
      ? this.http.put<Respuesta<Caja>>(`${this.base}/cajas/${id}`, datos)
      : this.http.post<Respuesta<Caja>>(`${this.base}/cajas`, datos);
    return pedido.pipe(map((r) => r.data));
  }

  /** Cómo saldrá el próximo comprobante. No guarda ni consume números. */
  vistaPrevia(datos: Partial<DatosCaja> & { caja_id?: number | null }): Observable<VistaPreviaComprobante> {
    return this.http
      .post<Respuesta<VistaPreviaComprobante>>(`${this.base}/cajas/vista-previa`, datos)
      .pipe(map((r) => r.data));
  }

  // --------------------------------------------------------- Conceptos
  conceptos(): Observable<Concepto[]> {
    return this.http.get<Respuesta<Concepto[]>>(`${this.base}/conceptos`).pipe(map((r) => r.data));
  }

  guardarConcepto(datos: Partial<Concepto>, id?: number): Observable<Concepto> {
    const pedido = id
      ? this.http.put<Respuesta<Concepto>>(`${this.base}/conceptos/${id}`, datos)
      : this.http.post<Respuesta<Concepto>>(`${this.base}/conceptos`, datos);
    return pedido.pipe(map((r) => r.data));
  }

  // ---------------------------------------------------------- Operación
  abrir(cajaId: number, saldoInicial: Partial<Record<Moneda, number | null>>): Observable<Respuesta<SesionAbierta>> {
    return this.http.post<Respuesta<SesionAbierta>>(`${this.base}/cajas/${cajaId}/sesiones`, { saldo_inicial: saldoInicial });
  }

  registrar(sesionId: number, datos: DatosMovimiento): Observable<Respuesta<Movimiento> & { saldos: SaldoSesion[] }> {
    return this.http.post<Respuesta<Movimiento> & { saldos: SaldoSesion[] }>(
      `${this.base}/sesiones/${sesionId}/movimientos`, datos);
  }

  anular(movimientoId: number, motivo: string): Observable<Respuesta<Movimiento> & { saldos: SaldoSesion[] }> {
    return this.http.post<Respuesta<Movimiento> & { saldos: SaldoSesion[] }>(
      `${this.base}/movimientos/${movimientoId}/anular`, { motivo });
  }

  comprobante(movimientoId: number): Observable<Blob> {
    return this.http.get(`${this.base}/movimientos/${movimientoId}/comprobante`, { responseType: 'blob' });
  }
}
