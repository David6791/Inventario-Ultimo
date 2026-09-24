import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Paginado } from '../models/auth.models';
import {
  DetalleExistencia, EncabezadoKardex, Existencia, FiltroExistencias,
  FiltroKardex, MovimientoKardex, ResumenExistencias,
} from '../models/existencia.models';

@Injectable({ providedIn: 'root' })
export class ExistenciaService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /*
   | El filtro llega como objeto y se convierte a parámetros descartando lo
   | vacío. `object` en vez de `Record<string, unknown>`: las interfaces sin
   | índice no son asignables a Record, y no vale la pena ensuciarlas con un
   | index signature solo para esto.
   */
  private parametros(filtro: object, pagina?: number): HttpParams {
    let params = new HttpParams();

    if (pagina) params = params.set('page', pagina);

    Object.entries(filtro).forEach(([clave, valor]) => {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(clave, String(valor));
      }
    });

    return params;
  }

  // --- Existencias -------------------------------------------------------

  listar(filtro: FiltroExistencias = {}, pagina = 1): Observable<Paginado<Existencia>> {
    return this.http.get<Paginado<Existencia>>(`${this.api}/existencias`, {
      params: this.parametros(filtro, pagina),
    });
  }

  /** Totales del almacén. Van aparte para que la paginación no los afecte. */
  resumen(): Observable<ResumenExistencias> {
    return this.http.get<ResumenExistencias>(`${this.api}/existencias/resumen`);
  }

  /** Saldo de un producto con sus capas de costo vivas. */
  detalle(productoId: number): Observable<DetalleExistencia> {
    return this.http.get<DetalleExistencia>(`${this.api}/existencias/${productoId}`);
  }

  // --- Kardex ------------------------------------------------------------

  kardex(
    productoId: number, filtro: FiltroKardex = {}, pagina = 1,
  ): Observable<Paginado<MovimientoKardex>> {
    return this.http.get<Paginado<MovimientoKardex>>(`${this.api}/kardex/${productoId}`, {
      params: this.parametros(filtro, pagina),
    });
  }

  encabezadoKardex(productoId: number): Observable<EncabezadoKardex> {
    return this.http.get<EncabezadoKardex>(`${this.api}/kardex/${productoId}/encabezado`);
  }

  descargarKardex(productoId: number, filtro: FiltroKardex = {}): Observable<Blob> {
    return this.http.get(`${this.api}/kardex/${productoId}/pdf`, {
      params: this.parametros(filtro),
      responseType: 'blob',
    });
  }
}
