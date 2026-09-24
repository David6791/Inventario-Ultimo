import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Devolucion, FiltroDevoluciones, SalidaDevolvible,
} from '../models/devolucion.models';

interface Pagina<T> {
  data: T[];
  total: number;
  current_page: number;
  per_page: number;
}

@Injectable({ providedIn: 'root' })
export class DevolucionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/devoluciones`;

  listar(filtro: FiltroDevoluciones, pagina = 1): Observable<Pagina<Devolucion>> {
    let params = new HttpParams().set('page', pagina);

    Object.entries(filtro).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    });

    return this.http.get<Pagina<Devolucion>>(this.url, { params });
  }

  ver(id: number): Observable<Devolucion> {
    return this.http.get<Devolucion>(`${this.url}/${id}`);
  }

  /** Qué queda por devolver de una salida. Vacío si ya se devolvió todo. */
  devolvibleDe(salidaId: number): Observable<SalidaDevolvible> {
    return this.http.get<SalidaDevolvible>(`${environment.apiUrl}/salidas/${salidaId}/devolvible`);
  }

  registrar(datos: {
    salida_id: number;
    fecha: string;
    motivo: string;
    observaciones?: string;
    items: { salida_detalle_id: number; cantidad: number; estado_bien?: string; observaciones?: string }[];
  }): Observable<{ devolucion: Devolucion; mensaje: string }> {
    return this.http.post<{ devolucion: Devolucion; mensaje: string }>(this.url, datos);
  }

  anular(id: number, motivo: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.url}/${id}/anular`, { motivo });
  }
    /** La nota escaneada y firmada por quien entregó el material. */
  subirNota(id: number, archivo: File): Observable<{ mensaje: string }> {
    const cuerpo = new FormData();

    cuerpo.append('archivo', archivo);

    return this.http.post<{ mensaje: string }>(`${this.url}/${id}/respaldo`, cuerpo);
  }

  pdf(id: number): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/pdf`, { responseType: 'blob' });
  }
}
