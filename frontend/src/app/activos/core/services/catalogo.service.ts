import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Clase, Parametro, RespuestaApi, Subclase, Ubicacion } from '../models/catalogo.model';

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/activos`;

  // ---------------------------------------------------------------- Clases

  listarClases(soloActivas = false): Observable<Clase[]> {
    const params = new HttpParams().set('solo_activas', soloActivas);
    return this.http
      .get<RespuestaApi<Clase[]>>(`${this.base}/clases`, { params })
      .pipe(map((r) => r.data));
  }

  verClase(id: number): Observable<Clase> {
    return this.http
      .get<RespuestaApi<Clase>>(`${this.base}/clases/${id}`)
      .pipe(map((r) => r.data));
  }

  crearClase(clase: Partial<Clase>): Observable<Clase> {
    return this.http
      .post<RespuestaApi<Clase>>(`${this.base}/clases`, clase)
      .pipe(map((r) => r.data));
  }

  actualizarClase(id: number, clase: Partial<Clase>): Observable<Clase> {
    return this.http
      .put<RespuestaApi<Clase>>(`${this.base}/clases/${id}`, clase)
      .pipe(map((r) => r.data));
  }

  desactivarClase(id: number): Observable<RespuestaApi<Clase>> {
    return this.http.delete<RespuestaApi<Clase>>(`${this.base}/clases/${id}`);
  }

  // ------------------------------------------------------------- Subclases

  listarSubclases(claseId?: number): Observable<Subclase[]> {
    let params = new HttpParams();
    if (claseId) {
      params = params.set('clase_id', claseId);
    }
    return this.http
      .get<RespuestaApi<Subclase[]>>(`${this.base}/subclases`, { params })
      .pipe(map((r) => r.data));
  }

  crearSubclase(subclase: Partial<Subclase>): Observable<Subclase> {
    return this.http
      .post<RespuestaApi<Subclase>>(`${this.base}/subclases`, subclase)
      .pipe(map((r) => r.data));
  }

  actualizarSubclase(id: number, subclase: Partial<Subclase>): Observable<Subclase> {
    return this.http
      .put<RespuestaApi<Subclase>>(`${this.base}/subclases/${id}`, subclase)
      .pipe(map((r) => r.data));
  }

  desactivarSubclase(id: number): Observable<RespuestaApi<Subclase>> {
    return this.http.delete<RespuestaApi<Subclase>>(`${this.base}/subclases/${id}`);
  }

  // ----------------------------------------------------------- Ubicaciones

  listarUbicaciones(soloActivas = false): Observable<Ubicacion[]> {
    const params = new HttpParams().set('solo_activas', soloActivas);
    return this.http
      .get<RespuestaApi<Ubicacion[]>>(`${this.base}/ubicaciones`, { params })
      .pipe(map((r) => r.data));
  }

  /** Estructura lista para p-tree. Útil al elegir ubicación en el alta. */
  arbolUbicaciones(): Observable<unknown[]> {
    return this.http
      .get<RespuestaApi<unknown[]>>(`${this.base}/ubicaciones/arbol`)
      .pipe(map((r) => r.data));
  }

  crearUbicacion(ubicacion: Partial<Ubicacion>): Observable<Ubicacion> {
    return this.http
      .post<RespuestaApi<Ubicacion>>(`${this.base}/ubicaciones`, ubicacion)
      .pipe(map((r) => r.data));
  }

  actualizarUbicacion(id: number, ubicacion: Partial<Ubicacion>): Observable<Ubicacion> {
    return this.http
      .put<RespuestaApi<Ubicacion>>(`${this.base}/ubicaciones/${id}`, ubicacion)
      .pipe(map((r) => r.data));
  }

  desactivarUbicacion(id: number): Observable<RespuestaApi<Ubicacion>> {
    return this.http.delete<RespuestaApi<Ubicacion>>(`${this.base}/ubicaciones/${id}`);
  }

  // ------------------------------------------------------------ Parámetros

  listarParametros(): Observable<Parametro[]> {
    return this.http
      .get<RespuestaApi<Parametro[]>>(`${this.base}/parametros`)
      .pipe(map((r) => r.data));
  }

  historialParametro(clave: string): Observable<Parametro[]> {
    return this.http
      .get<RespuestaApi<Parametro[]>>(`${this.base}/parametros/${clave}/historial`)
      .pipe(map((r) => r.data));
  }

  /** Valor efectivo a una fecha. Necesario porque los parámetros tienen vigencia. */
  valorParametroA(clave: string, fecha?: string): Observable<unknown> {
    let params = new HttpParams();
    if (fecha) {
      params = params.set('fecha', fecha);
    }
    return this.http
      .get<RespuestaApi<{ clave: string; valor: unknown }>>(
        `${this.base}/parametros/${clave}/valor`, { params }
      )
      .pipe(map((r) => r.data.valor));
  }

  actualizarParametro(
    clave: string,
    valor: string,
    vigenteDesde: string,
    descripcion?: string
  ): Observable<RespuestaApi<Parametro>> {
    return this.http.put<RespuestaApi<Parametro>>(`${this.base}/parametros/${clave}`, {
      valor,
      vigente_desde: vigenteDesde,
      descripcion,
    });
  }
}
