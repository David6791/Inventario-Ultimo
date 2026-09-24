import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Solicitante, UnidadSolicitante } from '../models/solicitante.models';

export interface FiltroSolicitantes {
  unidad_id?: number;
  solo_activos?: boolean;
  solo_retiran?: boolean;
  buscar?: string;
}

@Injectable({ providedIn: 'root' })
export class SolicitanteService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  // --- Unidades ----------------------------------------------------------

  unidades(soloActivas = false): Observable<{ data: UnidadSolicitante[] }> {
    const params = soloActivas ? new HttpParams().set('solo_activas', true) : undefined;
    return this.http.get<{ data: UnidadSolicitante[] }>(
      `${this.api}/unidades-solicitantes`, { params },
    );
  }

  crearUnidad(datos: Partial<UnidadSolicitante>): Observable<UnidadSolicitante> {
    return this.http.post<UnidadSolicitante>(`${this.api}/unidades-solicitantes`, datos);
  }

  actualizarUnidad(
    id: number, datos: Partial<UnidadSolicitante>,
  ): Observable<{ data: UnidadSolicitante }> {
    return this.http.put<{ data: UnidadSolicitante }>(
      `${this.api}/unidades-solicitantes/${id}`, datos,
    );
  }

  eliminarUnidad(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.api}/unidades-solicitantes/${id}`);
  }

  // --- Solicitantes ------------------------------------------------------

  listar(filtro: FiltroSolicitantes = {}): Observable<{ data: Solicitante[] }> {
    let params = new HttpParams();

    Object.entries(filtro).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    });

    return this.http.get<{ data: Solicitante[] }>(`${this.api}/solicitantes`, { params });
  }

  crear(datos: Partial<Solicitante>): Observable<Solicitante> {
    return this.http.post<Solicitante>(`${this.api}/solicitantes`, datos);
  }

  actualizar(id: number, datos: Partial<Solicitante>): Observable<{ data: Solicitante }> {
    return this.http.put<{ data: Solicitante }>(`${this.api}/solicitantes/${id}`, datos);
  }

  eliminar(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.api}/solicitantes/${id}`);
  }
}
