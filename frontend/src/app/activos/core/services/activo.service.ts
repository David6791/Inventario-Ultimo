import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Activo, ActivoLista, EtiquetaActivo, FiltrosActivo, Paginado,
} from '../models/activo.model';

@Injectable({ providedIn: 'root' })
export class ActivoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/activos/activos`;

  listar(filtros: FiltrosActivo = {}): Observable<Paginado<ActivoLista>> {
    let params = new HttpParams();

    Object.entries(filtros).forEach(([clave, valor]) => {
      if (valor !== null && valor !== undefined && valor !== '') {
        params = params.set(clave, String(valor));
      }
    });

    return this.http.get<Paginado<ActivoLista>>(this.base, { params });
  }

  ver(id: number): Observable<Activo> {
    return this.http
      .get<{ data: Activo }>(`${this.base}/${id}`)
      .pipe(map((r) => r.data));
  }

  /** Búsqueda por código exacto. La usa el escáner QR del inventario. */
  porCodigo(codigo: string): Observable<Activo> {
    return this.http
      .get<{ data: Activo }>(`${this.base}/codigo/${encodeURIComponent(codigo)}`)
      .pipe(map((r) => r.data));
  }

  crear(payload: unknown): Observable<Activo> {
    return this.http
      .post<{ data: Activo }>(this.base, payload)
      .pipe(map((r) => r.data));
  }

  actualizar(id: number, payload: unknown): Observable<Activo> {
    return this.http
      .put<{ data: Activo }>(`${this.base}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  etiquetas(ids: number[]): Observable<EtiquetaActivo[]> {
    return this.http
      .post<{ data: EtiquetaActivo[] }>(`${this.base}/etiquetas`, { ids })
      .pipe(map((r) => r.data));
  }
}
