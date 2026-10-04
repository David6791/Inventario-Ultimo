import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BienDeCustodio, Documento, FiltrosDocumento,
} from '../models/documento.model';
import { Paginado } from '../models/activo.model';

@Injectable({ providedIn: 'root' })
export class DocumentoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/activos/documentos`;

  listar(filtros: FiltrosDocumento = {}): Observable<Paginado<Documento>> {
    let params = new HttpParams();

    Object.entries(filtros).forEach(([clave, valor]) => {
      if (valor !== null && valor !== undefined && valor !== '') {
        params = params.set(clave, String(valor));
      }
    });

    return this.http.get<Paginado<Documento>>(this.base, { params });
  }

  ver(id: number): Observable<Documento> {
    return this.http
      .get<{ data: Documento }>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  /** Crea el documento en BORRADOR: todavía no afecta a ningún activo. */
  emitir(payload: unknown): Observable<Documento> {
    return this.http
      .post<{ data: Documento }>(this.base, payload)
      .pipe(map((r) => r.data));
  }

  /** Acá es donde el estado de los bienes cambia realmente. */
  confirmar(id: number): Observable<{ data: Documento; mensaje: string }> {
    return this.http.post<{ data: Documento; mensaje: string }>(
      `${this.base}/${id}/confirmar`, {}
    );
  }

  anular(id: number, motivo: string): Observable<{ data: Documento; mensaje: string }> {
    return this.http.post<{ data: Documento; mensaje: string }>(
      `${this.base}/${id}/anular`, { motivo }
    );
  }

  registrarRetorno(id: number, fecha?: string): Observable<{ data: Documento; mensaje: string }> {
    return this.http.post<{ data: Documento; mensaje: string }>(
      `${this.base}/${id}/retorno`, { fecha }
    );
  }

  /** Bienes a cargo de una persona. Base del descargo laboral. */
  porCustodio(custodioId: number): Observable<{
    data: BienDeCustodio[];
    resumen: { cantidad: number; valor: number };
  }> {
    return this.http.get<{
      data: BienDeCustodio[];
      resumen: { cantidad: number; valor: number };
    }>(`${environment.apiUrl}/activos/custodios/${custodioId}/activos`);
  }
}
