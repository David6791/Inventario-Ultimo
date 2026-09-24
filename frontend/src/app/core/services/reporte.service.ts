import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FiltroReporte, ResultadoReporte, TipoReporte } from '../models/reporte.models';

@Injectable({ providedIn: 'root' })
export class ReporteService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  private parametros(filtro: FiltroReporte): HttpParams {
    let params = new HttpParams();

    Object.entries(filtro).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    });

    return params;
  }

  /** Los datos para la pantalla. */
  generar(tipo: TipoReporte, filtro: FiltroReporte = {}): Observable<ResultadoReporte> {
    return this.http.get<ResultadoReporte>(`${this.api}/reportes/${tipo}`, {
      params: this.parametros(filtro),
    });
  }

  descargarPdf(tipo: TipoReporte, filtro: FiltroReporte = {}): Observable<Blob> {
    return this.http.get(`${this.api}/reportes/${tipo}/pdf`, {
      params: this.parametros(filtro),
      responseType: 'blob',
    });
  }

  descargarExcel(tipo: TipoReporte, filtro: FiltroReporte = {}): Observable<Blob> {
    return this.http.get(`${this.api}/reportes/${tipo}/excel`, {
      params: this.parametros(filtro),
      responseType: 'blob',
    });
  }
}
