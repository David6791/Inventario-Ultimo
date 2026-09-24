import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Almacen, Paginado, Usuario } from '../models/auth.models';

export interface UsuarioPayload {
  ci: string | null;
  name: string;
  email: string;
  cargo: string | null;
  telefono: string | null;
  password?: string;
  password_confirmation?: string;
  roles: string[];
  almacenes: number[];
  almacen_predeterminado_id: number | null;
}

export interface FiltroUsuarios {
  buscar?: string;
  rol?: string;
  almacen_id?: number;
  activo?: boolean;
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  listar(filtro: FiltroUsuarios = {}, pagina = 1): Observable<Paginado<Usuario>> {
    let params = new HttpParams().set('page', pagina);
    Object.entries(filtro).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    });
    return this.http.get<Paginado<Usuario>>(`${this.api}/usuarios`, { params });
  }

  obtener(id: number): Observable<{ data: Usuario }> {
    return this.http.get<{ data: Usuario }>(`${this.api}/usuarios/${id}`);
  }

  crear(payload: UsuarioPayload): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.api}/usuarios`, payload);
  }

  actualizar(id: number, payload: UsuarioPayload): Observable<{ data: Usuario }> {
    return this.http.put<{ data: Usuario }>(`${this.api}/usuarios/${id}`, payload);
  }

  cambiarEstado(id: number, activo: boolean): Observable<{ data: Usuario }> {
    return this.http.patch<{ data: Usuario }>(`${this.api}/usuarios/${id}/estado`, { activo });
  }

  restablecerClave(id: number): Observable<{ mensaje: string; password_temporal: string }> {
    return this.http.post<{ mensaje: string; password_temporal: string }>(
      `${this.api}/usuarios/${id}/restablecer-clave`, {},
    );
  }

  almacenes(): Observable<{ data: Almacen[] }> {
    return this.http.get<{ data: Almacen[] }>(`${this.api}/almacenes`);
  }
}
