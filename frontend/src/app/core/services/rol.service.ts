import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ModuloPermisos, Paginado, Rol } from '../models/auth.models';

export interface RolPayload {
  name: string;
  descripcion: string | null;
  permisos: string[];
}

@Injectable({ providedIn: 'root' })
export class RolService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  listar(buscar = '', pagina = 1): Observable<Paginado<Rol>> {
    let params = new HttpParams().set('page', pagina);
    if (buscar) params = params.set('buscar', buscar);
    return this.http.get<Paginado<Rol>>(`${this.api}/roles`, { params });
  }

  obtener(id: number): Observable<{ data: Rol }> {
    return this.http.get<{ data: Rol }>(`${this.api}/roles/${id}`);
  }

  /** Catálogo agrupado por módulo, para el árbol de la pantalla de roles. */
  catalogoPermisos(): Observable<{ data: ModuloPermisos[] }> {
    return this.http.get<{ data: ModuloPermisos[] }>(`${this.api}/permisos`);
  }

  crear(payload: RolPayload): Observable<Rol> {
    return this.http.post<Rol>(`${this.api}/roles`, payload);
  }

  actualizar(id: number, payload: RolPayload): Observable<{ data: Rol }> {
    return this.http.put<{ data: Rol }>(`${this.api}/roles/${id}`, payload);
  }

  eliminar(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.api}/roles/${id}`);
  }

  duplicar(id: number): Observable<Rol> {
    return this.http.post<Rol>(`${this.api}/roles/${id}/duplicar`, {});
  }
}
