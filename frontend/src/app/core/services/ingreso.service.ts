import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paginado } from '../models/auth.models';
import {
  FiltroIngresos, Ingreso, IngresoPayload, SolicitudPendiente,
} from '../models/ingreso.models';

@Injectable({ providedIn: 'root' })
export class IngresoService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  listar(filtro: FiltroIngresos = {}, pagina = 1): Observable<Paginado<Ingreso>> {
    let params = new HttpParams().set('page', pagina);

    Object.entries(filtro).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    });

    return this.http.get<Paginado<Ingreso>>(`${this.api}/ingresos`, { params });
  }

  obtener(id: number): Observable<{ data: Ingreso }> {
    return this.http.get<{ data: Ingreso }>(`${this.api}/ingresos/${id}`);
  }

  /** Solicitudes aprobadas con saldo por recibir, con sus líneas pendientes. */
  pendientes(): Observable<{ data: SolicitudPendiente[] }> {
    return this.http.get<{ data: SolicitudPendiente[] }>(`${this.api}/ingresos/pendientes`);
  }

  crear(datos: IngresoPayload): Observable<Ingreso> {
    return this.http.post<Ingreso>(`${this.api}/ingresos`, datos);
  }

  actualizar(id: number, datos: IngresoPayload): Observable<{ data: Ingreso }> {
    return this.http.put<{ data: Ingreso }>(`${this.api}/ingresos/${id}`, datos);
  }

  eliminarBorrador(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.api}/ingresos/${id}`);
  }

  /** Crea las capas de costo, sube el stock y descuenta el saldo de la solicitud. */
  confirmar(id: number): Observable<{ data: Ingreso }> {
    return this.http.post<{ data: Ingreso }>(`${this.api}/ingresos/${id}/confirmar`, {});
  }

  anular(id: number, motivo: string): Observable<{ data: Ingreso }> {
    return this.http.post<{ data: Ingreso }>(`${this.api}/ingresos/${id}/anular`, { motivo });
  }

  subirRespaldo(id: number, archivo: File): Observable<{ data: Ingreso }> {
    const cuerpo = new FormData();
    cuerpo.append('respaldo', archivo);
    return this.http.post<{ data: Ingreso }>(`${this.api}/ingresos/${id}/respaldo`, cuerpo);
  }

  descargarRespaldo(id: number): Observable<Blob> {
    return this.http.get(`${this.api}/ingresos/${id}/respaldo`, { responseType: 'blob' });
  }

  descargarActa(id: number): Observable<Blob> {
    return this.http.get(`${this.api}/ingresos/${id}/pdf`, { responseType: 'blob' });
  }
}
