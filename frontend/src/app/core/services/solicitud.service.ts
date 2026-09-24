import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paginado } from '../models/auth.models';
import {
  FiltroSolicitudes, Solicitud, SolicitudPayload, TipoSolicitud,
} from '../models/solicitud.models';

/**
 * Un solo servicio para los dos tipos, con el segmento de la API como
 * parámetro.
 *
 * En el backend las tablas están separadas porque ahí hay integridad que
 * proteger: la clave foránea impide que un ingreso se cuelgue de una solicitud
 * de material. Acá no hay nada de eso — solo peticiones HTTP con la misma
 * forma — así que dos copias del mismo servicio serían trabajo sin beneficio.
 */
@Injectable({ providedIn: 'root' })
export class SolicitudService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /*
   | El parámetro `tipo` se conserva aunque hoy solo exista 'compra': mantiene
   | la firma estable si mañana vuelve a haber variantes, y no cuesta nada.
   */
  private ruta(tipo: TipoSolicitud): string {
    return 'solicitudes-compra';
  }

  listar(
    tipo: TipoSolicitud,
    filtro: FiltroSolicitudes = {},
    pagina = 1,
  ): Observable<Paginado<Solicitud>> {
    let params = new HttpParams().set('page', pagina);

    Object.entries(filtro).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    });

    return this.http.get<Paginado<Solicitud>>(`${this.api}/${this.ruta(tipo)}`, { params });
  }

  obtener(tipo: TipoSolicitud, id: number): Observable<{ data: Solicitud }> {
    return this.http.get<{ data: Solicitud }>(`${this.api}/${this.ruta(tipo)}/${id}`);
  }

  crear(tipo: TipoSolicitud, datos: SolicitudPayload): Observable<Solicitud> {
    return this.http.post<Solicitud>(`${this.api}/${this.ruta(tipo)}`, datos);
  }

  actualizar(
    tipo: TipoSolicitud, id: number, datos: SolicitudPayload,
  ): Observable<{ data: Solicitud }> {
    return this.http.put<{ data: Solicitud }>(`${this.api}/${this.ruta(tipo)}/${id}`, datos);
  }

  eliminarBorrador(tipo: TipoSolicitud, id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.api}/${this.ruta(tipo)}/${id}`);
  }

  /** Registra la aprobación física. FormData porque lleva el PDF adjunto. */
  aprobar(
    tipo: TipoSolicitud,
    id: number,
    aprobada: boolean,
    fecha: string,
    observacion: string | null,
    documento: File | null,
  ): Observable<{ data: Solicitud }> {
    const cuerpo = new FormData();
    cuerpo.append('aprobada', aprobada ? '1' : '0');
    cuerpo.append('fecha_aprobacion', fecha);
    if (observacion) cuerpo.append('observacion', observacion);
    if (documento) cuerpo.append('documento', documento);

    return this.http.post<{ data: Solicitud }>(
      `${this.api}/${this.ruta(tipo)}/${id}/aprobar`, cuerpo,
    );
  }

  anular(tipo: TipoSolicitud, id: number, motivo: string): Observable<{ data: Solicitud }> {
    return this.http.post<{ data: Solicitud }>(
      `${this.api}/${this.ruta(tipo)}/${id}/anular`, { motivo },
    );
  }

  /**
   * El formulario para imprimir, firmar y escanear.
   * Se genera al vuelo: no se archiva porque siempre se puede volver a emitir.
   * Lo que sí se archiva es el escaneo firmado.
   */
  descargarFormulario(tipo: TipoSolicitud, id: number): Observable<Blob> {
    return this.http.get(`${this.api}/${this.ruta(tipo)}/${id}/pdf`, {
      responseType: 'blob',
    });
  }

  /** El escaneo firmado. No está en disco público: se sirve por la API. */
  descargarDocumento(tipo: TipoSolicitud, id: number): Observable<Blob> {
    return this.http.get(`${this.api}/${this.ruta(tipo)}/${id}/documento`, {
      responseType: 'blob',
    });
  }
}
