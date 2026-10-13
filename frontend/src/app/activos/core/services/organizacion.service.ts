import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Almacen, Area, CentroCosto, Custodio, Empleado, FilaPersonal, ResumenImportacion,
} from '../models/organizacion.model';

@Injectable({ providedIn: 'root' })
export class OrganizacionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/activos`;

  // ────────────────────────────────────────────────────────────── Personal

  listarEmpleados(filtros: {
    buscar?: string; centro_costo_id?: number;
    solo_con_acceso?: boolean; incluir_bajas?: boolean;
  } = {}): Observable<Empleado[]> {
    let params = new HttpParams();

    Object.entries(filtros).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') params = params.set(k, String(v));
    });

    return this.http
      .get<{ data: Empleado[] }>(`${this.base}/empleados`, { params })
      .pipe(map((r) => r.data));
  }

  verEmpleado(id: number): Observable<Empleado> {
    return this.http
      .get<{ data: Empleado }>(`${this.base}/empleados/${id}`)
      .pipe(map((r) => r.data));
  }

  crearEmpleado(datos: Partial<Empleado>): Observable<Empleado> {
    return this.http
      .post<{ data: Empleado }>(`${this.base}/empleados`, datos)
      .pipe(map((r) => r.data));
  }

  actualizarEmpleado(id: number, datos: Partial<Empleado>): Observable<Empleado> {
    return this.http
      .put<{ data: Empleado }>(`${this.base}/empleados/${id}`, datos)
      .pipe(map((r) => r.data));
  }

  /** Falla si la persona tiene bienes a su cargo: primero hay que descargarlos. */
  darDeBaja(id: number, fecha: string): Observable<{ data: Empleado; mensaje: string }> {
    return this.http.post<{ data: Empleado; mensaje: string }>(
      `${this.base}/empleados/${id}/baja`, { fecha_baja: fecha }
    );
  }

  // ────────────────────────────────────────────────────────── Importación

  validarImportacion(archivo: File): Observable<{
    filas: FilaPersonal[]; resumen: ResumenImportacion;
  }> {
    const datos = new FormData();
    datos.append('archivo', archivo);

    return this.http.post<{ filas: FilaPersonal[]; resumen: ResumenImportacion }>(
      `${this.base}/empleados/importar/validar`, datos
    );
  }

  importar(archivo: File): Observable<{
    data: { creados: number; actualizados: number }; mensaje: string;
  }> {
    const datos = new FormData();
    datos.append('archivo', archivo);

    return this.http.post<{
      data: { creados: number; actualizados: number }; mensaje: string;
    }>(`${this.base}/empleados/importar`, datos);
  }

  // ────────────────────────────────────────────────── Centros de costo

  listarCentros(incluirInactivos = false): Observable<CentroCosto[]> {
    const params = new HttpParams().set('incluir_inactivos', incluirInactivos);

    return this.http
      .get<{ data: CentroCosto[] }>(`${this.base}/centros-costo`, { params })
      .pipe(map((r) => r.data));
  }

  listarAreas(): Observable<Area[]> {
    return this.http
      .get<{ data: Area[] }>(`${this.base}/areas`)
      .pipe(map((r) => r.data));
  }

  crearCentro(datos: Partial<CentroCosto>): Observable<CentroCosto> {
    return this.http
      .post<{ data: CentroCosto }>(`${this.base}/centros-costo`, datos)
      .pipe(map((r) => r.data));
  }

  actualizarCentro(id: number, datos: Partial<CentroCosto>): Observable<{
    data: CentroCosto; mensaje: string;
  }> {
    return this.http.put<{ data: CentroCosto; mensaje: string }>(
      `${this.base}/centros-costo/${id}`, datos
    );
  }

  // ─────────────────────────────────────────────────────────── Custodios

  /** Empleados a los que se puede asignar un bien, dentro del ámbito. */
  listarCustodios(centroId?: number): Observable<Custodio[]> {
    let params = new HttpParams();
    if (centroId) params = params.set('centro_costo_id', centroId);

    return this.http
      .get<{ data: Custodio[] }>(`${this.base}/custodios`, { params })
      .pipe(map((r) => r.data));
  }
    /** Almacenes activos, para asignar el ámbito de un centro de costo. */
  listarAlmacenes(): Observable<Almacen[]> {
    return this.http
      .get<{ data: Almacen[] }>(`${this.base}/almacenes`)
      .pipe(map((r) => r.data));
  }
  descargarPlantilla(): Observable<Blob> {
      return this.http.get(`${this.base}/empleados/importar/plantilla`,
        { responseType: 'blob' });
    }
}
