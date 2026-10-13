import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Cierre, FilaConciliacion, FilaValuacion, ResumenConciliacion,
} from '../models/cierre.model';

@Injectable({ providedIn: 'root' })
export class CierreService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/activos/cierres`;

  listar(): Observable<Cierre[]> {
    return this.http
      .get<{ data: Cierre[] }>(this.base)
      .pipe(map((r) => r.data));
  }

  ver(id: number): Observable<Cierre> {
    return this.http
      .get<{ data: Cierre }>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  /** Crea el período con su UFV. Todavía no calcula nada. */
  abrir(periodo: string, ufvInicial: number, ufvFinal: number): Observable<Cierre> {
    return this.http
      .post<{ data: Cierre }>(this.base, {
        periodo, ufv_inicial: ufvInicial, ufv_final: ufvFinal,
      })
      .pipe(map((r) => r.data));
  }

  /** Recalcula desde cero: borra las valuaciones anteriores del período. */
  calcular(id: number): Observable<{ data: Cierre; mensaje: string }> {
    return this.http.post<{ data: Cierre; mensaje: string }>(
      `${this.base}/${id}/calcular`, {}
    );
  }

  cerrar(id: number, comprobante?: string): Observable<{ data: Cierre; mensaje: string }> {
    return this.http.post<{ data: Cierre; mensaje: string }>(
      `${this.base}/${id}/cerrar`, { comprobante }
    );
  }

  reabrir(id: number): Observable<{ data: Cierre; mensaje: string }> {
    return this.http.post<{ data: Cierre; mensaje: string }>(
      `${this.base}/${id}/reabrir`, {}
    );
  }

  /** Auxiliar por activo. Es lo que concilia con el mayor contable. */
  detalle(id: number, tipo: 'FINANCIERA' | 'IMPOSITIVA' = 'FINANCIERA'): Observable<FilaValuacion[]> {
    const params = new HttpParams().set('tipo', tipo);

    return this.http
      .get<{ data: FilaValuacion[] }>(`${this.base}/${id}/detalle`, { params })
      .pipe(map((r) => r.data));
  }

  /** Financiera contra impositiva: lo que va a la determinación del IUE. */
  conciliacion(id: number): Observable<{
    data: FilaConciliacion[]; resumen: ResumenConciliacion;
  }> {
    return this.http.get<{
      data: FilaConciliacion[]; resumen: ResumenConciliacion;
    }>(`${this.base}/${id}/conciliacion`);
  }
}
