import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BonoCalculado, BonoPendiente, DatosPesaje, DatosRecepcion, Lote, Pagina, Pesaje, RespuestaApi, TablaTramos, Tramo,
} from '../models/cargas.model';

export interface FiltroLotes { buscar?: string; estado?: string | null; serie_id?: number | null; desde?: string; hasta?: string; page?: number; }

@Injectable({ providedIn: 'root' })
export class RecepcionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/cargas`;

  listar(f: FiltroLotes): Observable<Pagina<Lote>> {
    const params: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(f)) if (v !== null && v !== undefined && v !== '') params[k] = v as string | number;
    return this.http.get<Pagina<Lote>>(`${this.base}/lotes`, { params });
  }

  ver(id: number): Observable<Lote> {
    return this.http.get<RespuestaApi<Lote>>(`${this.base}/lotes/${id}`).pipe(map((r) => r.data));
  }

  recibir(datos: DatosRecepcion): Observable<RespuestaApi<Lote> & { mensaje: string }> {
    return this.http.post<RespuestaApi<Lote> & { mensaje: string }>(`${this.base}/lotes`, datos);
  }

  anular(id: number, motivo: string): Observable<RespuestaApi<Lote> & { mensaje: string }> {
    return this.http.post<RespuestaApi<Lote> & { mensaje: string }>(`${this.base}/lotes/${id}/anular`, { motivo });
  }

  boleta(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/lotes/${id}/boleta`, { responseType: 'blob' });
  }

  rotulo(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/lotes/${id}/rotulo`, { responseType: 'blob' });
  }

  agregarPesaje(loteId: number, datos: DatosPesaje): Observable<RespuestaApi<Pesaje> & { mensaje: string }> {
    return this.http.post<RespuestaApi<Pesaje> & { mensaje: string }>(`${this.base}/lotes/${loteId}/pesajes`, datos);
  }

  anularPesaje(id: number, motivo: string): Observable<RespuestaApi<Pesaje> & { mensaje: string }> {
    return this.http.post<RespuestaApi<Pesaje> & { mensaje: string }>(`${this.base}/pesajes/${id}/anular`, { motivo });
  }

  // --------------------------------------------------------------- Bono
  tramos(): Observable<TablaTramos[]> {
    return this.http.get<RespuestaApi<TablaTramos[]>>(`${this.base}/bono-tramos`).pipe(map((r) => r.data));
  }

  publicarTramos(vigenteDesde: string, tramos: Tramo[]): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.base}/bono-tramos`, { vigente_desde: vigenteDesde, tramos });
  }

  calcularBono(pesoNetoKg: number): Observable<BonoCalculado | null> {
    return this.http.get<RespuestaApi<BonoCalculado | null>>(`${this.base}/bono-tramos/calcular`, { params: { peso_neto_kg: pesoNetoKg } })
      .pipe(map((r) => r.data));
  }

  bonosPendientes(cajaId: number): Observable<BonoPendiente[]> {
    return this.http.get<RespuestaApi<BonoPendiente[]>>(`${this.base}/bonos/pendientes`, { params: { caja_id: cajaId } })
      .pipe(map((r) => r.data));
  }

  pagarBono(bonoId: number, cajaId: number): Observable<RespuestaApi<{ id: number; numero: string }> & { mensaje: string }> {
    return this.http.post<RespuestaApi<{ id: number; numero: string }> & { mensaje: string }>(
      `${this.base}/bonos/${bonoId}/pagar`, { caja_id: cajaId });
  }
}
