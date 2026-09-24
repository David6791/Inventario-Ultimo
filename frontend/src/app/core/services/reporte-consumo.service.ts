import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FiltroConsumo, RespuestaConsumo } from '../models/consumo.models';

export type VistaConsumo = 'area' | 'solicitante' | 'producto';

@Injectable({ providedIn: 'root' })
export class ReporteConsumoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/reportes/consumo`;

  consultar(filtro: FiltroConsumo): Observable<RespuestaConsumo> {
    return this.http.get<RespuestaConsumo>(this.url, { params: this.params(filtro) });
  }

  /** PDF y Excel salen de la misma definición del backend. */
  descargar(filtro: FiltroConsumo, vista: VistaConsumo, formato: 'pdf' | 'excel'): Observable<Blob> {
    const params = this.params(filtro).set('vista', vista);

    return this.http.get(`${this.url}/${formato}`, { params, responseType: 'blob' });
  }

  private params(filtro: FiltroConsumo): HttpParams {
    let params = new HttpParams();

    Object.entries(filtro).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    });

    return params;
  }
}
