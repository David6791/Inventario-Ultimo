import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RespuestaApi, SerieLote, VistaPrevia } from '../models/cargas.model';

export interface DatosSerie {
  prefijo: string;
  nombre: string;
  linea_producto_id: number;
  origen: 'COMPRA' | 'PROPIA';
  formato: string;
  reinicio: 'NUNCA' | 'ANUAL' | 'MENSUAL' | 'DIARIO';
  activa: boolean;
}

@Injectable({ providedIn: 'root' })
export class SeriesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/cargas/series`;

  listar(): Observable<{ data: SerieLote[]; sigla: string | null }> {
    return this.http.get<{ data: SerieLote[]; sigla: string | null }>(this.base);
  }

  /** Cómo saldría el próximo código. No guarda ni consume números. */
  vistaPrevia(datos: Partial<DatosSerie> & { serie_id?: number | null }): Observable<VistaPrevia> {
    return this.http
      .post<RespuestaApi<VistaPrevia>>(`${this.base}/vista-previa`, datos)
      .pipe(map((r) => r.data));
  }

  guardar(datos: DatosSerie, id?: number): Observable<SerieLote> {
    const peticion = id
      ? this.http.put<RespuestaApi<SerieLote>>(`${this.base}/${id}`, datos)
      : this.http.post<RespuestaApi<SerieLote>>(this.base, datos);
    return peticion.pipe(map((r) => r.data));
  }

  continuarNumeracion(id: number, ultimoNumero: number): Observable<RespuestaApi<SerieLote>> {
    return this.http.put<RespuestaApi<SerieLote>>(`${this.base}/${id}/contador`, { ultimo_numero: ultimoNumero });
  }

  cambiarSigla(sigla: string): Observable<{ sigla: string; vigente_desde: string }> {
    return this.http
      .put<RespuestaApi<{ sigla: string; vigente_desde: string }>>(`${this.base}/sigla`, { sigla })
      .pipe(map((r) => r.data));
  }
}
