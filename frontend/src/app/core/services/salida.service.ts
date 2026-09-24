import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paginado } from '../models/auth.models';
import { FiltroSalidas, Salida, SalidaPayload } from '../models/salida.models';

@Injectable({ providedIn: 'root' })
export class SalidaService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  listar(filtro: FiltroSalidas = {}, pagina = 1): Observable<Paginado<Salida>> {
    let params = new HttpParams().set('page', pagina);

    Object.entries(filtro).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    });

    return this.http.get<Paginado<Salida>>(`${this.api}/salidas`, { params });
  }

  obtener(id: number): Observable<{ data: Salida }> {
    return this.http.get<{ data: Salida }>(`${this.api}/salidas/${id}`);
  }

  crear(datos: SalidaPayload): Observable<Salida> {
    return this.http.post<Salida>(`${this.api}/salidas`, datos);
  }

  actualizar(id: number, datos: SalidaPayload): Observable<{ data: Salida }> {
    return this.http.put<{ data: Salida }>(`${this.api}/salidas/${id}`, datos);
  }

  eliminarBorrador(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.api}/salidas/${id}`);
  }

  /** Descuenta existencias y escribe el kardex. Es el momento de la entrega. */
  confirmar(id: number): Observable<{ data: Salida }> {
    return this.http.post<{ data: Salida }>(`${this.api}/salidas/${id}/confirmar`, {});
  }

  /** Devuelve las existencias con un movimiento inverso en el kardex. */
  anular(id: number, motivo: string): Observable<{ data: Salida }> {
    return this.http.post<{ data: Salida }>(`${this.api}/salidas/${id}/anular`, { motivo });
  }

  /** El escaneo de la nota firmada. Llega después de confirmar. */
  subirRespaldo(id: number, archivo: File): Observable<{ data: Salida }> {
    const cuerpo = new FormData();
    cuerpo.append('respaldo', archivo);

    return this.http.post<{ data: Salida }>(`${this.api}/salidas/${id}/respaldo`, cuerpo);
  }

  descargarRespaldo(id: number): Observable<Blob> {
    return this.http.get(`${this.api}/salidas/${id}/respaldo`, { responseType: 'blob' });
  }

  /** La nota para imprimir y hacer firmar. Se genera al vuelo. */
  descargarNota(id: number): Observable<Blob> {
    return this.http.get(`${this.api}/salidas/${id}/pdf`, { responseType: 'blob' });
  }
}
