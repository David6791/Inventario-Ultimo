import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paginado } from '../models/auth.models';
import {
  FiltroTransferencias, RecepcionPayload, Transferencia, TransferenciaPayload,
} from '../models/transferencia.models';

@Injectable({ providedIn: 'root' })
export class TransferenciaService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  listar(filtro: FiltroTransferencias = {}, pagina = 1): Observable<Paginado<Transferencia>> {
    let params = new HttpParams().set('page', pagina);

    Object.entries(filtro).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    });

    return this.http.get<Paginado<Transferencia>>(`${this.api}/transferencias`, { params });
  }

  obtener(id: number): Observable<{ data: Transferencia }> {
    return this.http.get<{ data: Transferencia }>(`${this.api}/transferencias/${id}`);
  }

  crear(datos: TransferenciaPayload): Observable<Transferencia> {
    return this.http.post<Transferencia>(`${this.api}/transferencias`, datos);
  }

  actualizar(id: number, datos: TransferenciaPayload): Observable<{ data: Transferencia }> {
    return this.http.put<{ data: Transferencia }>(`${this.api}/transferencias/${id}`, datos);
  }

  eliminarBorrador(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.api}/transferencias/${id}`);
  }

  /** Descuenta el origen y pone el material en tránsito. */
  despachar(id: number): Observable<{ data: Transferencia }> {
    return this.http.post<{ data: Transferencia }>(
      `${this.api}/transferencias/${id}/despachar`, {},
    );
  }

  /** Suma el destino replicando las capas de costo que viajaron. */
  recibir(id: number, datos: RecepcionPayload): Observable<{ data: Transferencia }> {
    return this.http.post<{ data: Transferencia }>(
      `${this.api}/transferencias/${id}/recibir`, datos,
    );
  }

  anular(id: number, motivo: string): Observable<{ data: Transferencia }> {
    return this.http.post<{ data: Transferencia }>(
      `${this.api}/transferencias/${id}/anular`, { motivo },
    );
  }

  /** La guía que acompaña físicamente al material. */
  descargarGuia(id: number): Observable<Blob> {
    return this.http.get(`${this.api}/transferencias/${id}/pdf`, { responseType: 'blob' });
  }
}
