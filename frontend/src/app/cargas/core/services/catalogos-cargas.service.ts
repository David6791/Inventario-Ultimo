import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Banco, Bocamina, Cooperativa, Elemento, EstadoModulo, Laboratorio, LineaProducto, Mina,
  Municipio, Opciones, Pagina, Productor, ResultadoProductores, RespuestaApi, RevisionProductores,
} from '../models/cargas.model';

export interface FiltroProductores {
  buscar?: string;
  tipo?: string | null;
  cooperativa_id?: number | null;
  solo_activos?: boolean;
  pagina?: number;
  por_pagina?: number;
}

/**
 * Catálogos del módulo de cargas. Los listados chicos llegan completos y se
 * filtran en pantalla; productores se pagina y se busca en el servidor.
 */
@Injectable({ providedIn: 'root' })
export class CatalogosCargasService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/cargas`;

  /** Listas cerradas para desplegables: se piden una vez por sesión. */
  readonly opciones$: Observable<Opciones> = this.http
    .get<RespuestaApi<Opciones>>(`${this.base}/opciones`)
    .pipe(map((r) => r.data), shareReplay(1));

  estado(): Observable<EstadoModulo> {
    return this.http.get<EstadoModulo>(`${this.base}/estado`);
  }

  // ------------------------------------------------------------ Productores

  listarProductores(f: FiltroProductores = {}): Observable<Pagina<Productor>> {
    let params = new HttpParams()
      .set('page', f.pagina ?? 1)
      .set('por_pagina', f.por_pagina ?? 25);
    if (f.buscar) params = params.set('buscar', f.buscar);
    if (f.tipo) params = params.set('tipo', f.tipo);
    if (f.cooperativa_id) params = params.set('cooperativa_id', f.cooperativa_id);
    if (f.solo_activos) params = params.set('solo_activos', 1);
    return this.http.get<Pagina<Productor>>(`${this.base}/productores`, { params });
  }

  guardarProductor(datos: Partial<Productor>, id?: number): Observable<Productor> {
    return this.guardar<Productor>('productores', datos, id);
  }

  desactivarProductor(id: number): Observable<RespuestaApi<Productor>> {
    return this.http.delete<RespuestaApi<Productor>>(`${this.base}/productores/${id}`);
  }

  plantillaProductores(): Observable<Blob> {
    return this.http.get(`${this.base}/productores/importar/plantilla`, { responseType: 'blob' });
  }

  revisarProductores(archivo: File): Observable<RevisionProductores> {
    return this.http.post<RevisionProductores>(`${this.base}/productores/importar/revisar`, this.cuerpo(archivo));
  }

  importarProductores(archivo: File): Observable<ResultadoProductores> {
    return this.http.post<ResultadoProductores>(`${this.base}/productores/importar`, this.cuerpo(archivo));
  }

  // ----------------------------------------------------------- Cooperativas

  listarCooperativas(soloActivas = false): Observable<Cooperativa[]> {
    return this.listar<Cooperativa>('cooperativas', soloActivas ? { solo_activas: 1 } : {});
  }

  guardarCooperativa(datos: Partial<Cooperativa>, id?: number): Observable<Cooperativa> {
    return this.guardar<Cooperativa>('cooperativas', datos, id);
  }

  desactivarCooperativa(id: number): Observable<RespuestaApi<Cooperativa>> {
    return this.http.delete<RespuestaApi<Cooperativa>>(`${this.base}/cooperativas/${id}`);
  }

  // ------------------------------------------------------ Minas y bocaminas

  listarMinas(filtro: { cooperativa_id?: number; propia?: boolean; solo_activas?: boolean } = {}): Observable<Mina[]> {
    const params: Record<string, string | number> = {};
    if (filtro.cooperativa_id) params['cooperativa_id'] = filtro.cooperativa_id;
    if (filtro.propia !== undefined) params['propia'] = filtro.propia ? 1 : 0;
    if (filtro.solo_activas) params['solo_activas'] = 1;
    return this.listar<Mina>('minas', params);
  }

  guardarMina(datos: Partial<Mina>, id?: number): Observable<Mina> {
    return this.guardar<Mina>('minas', datos, id);
  }

  desactivarMina(id: number): Observable<RespuestaApi<Mina>> {
    return this.http.delete<RespuestaApi<Mina>>(`${this.base}/minas/${id}`);
  }

  listarBocaminas(minaId: number): Observable<Bocamina[]> {
    return this.listar<Bocamina>(`minas/${minaId}/bocaminas`);
  }

  crearBocamina(minaId: number, datos: Partial<Bocamina>): Observable<Bocamina> {
    return this.http
      .post<RespuestaApi<Bocamina>>(`${this.base}/minas/${minaId}/bocaminas`, datos)
      .pipe(map((r) => r.data));
  }

  actualizarBocamina(id: number, datos: Partial<Bocamina>): Observable<Bocamina> {
    return this.http
      .put<RespuestaApi<Bocamina>>(`${this.base}/bocaminas/${id}`, datos)
      .pipe(map((r) => r.data));
  }

  // --------------------------------------------------- Catálogos generales

  listarMunicipios(): Observable<Municipio[]> {
    return this.listar<Municipio>('municipios');
  }

  guardarMunicipio(datos: Partial<Municipio>, id?: number): Observable<Municipio> {
    return this.guardar<Municipio>('municipios', datos, id);
  }

  eliminarMunicipio(id: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.base}/municipios/${id}`);
  }

  listarLaboratorios(soloActivos = false): Observable<Laboratorio[]> {
    return this.listar<Laboratorio>('laboratorios', soloActivos ? { solo_activos: 1 } : {});
  }

  guardarLaboratorio(datos: Partial<Laboratorio>, id?: number): Observable<Laboratorio> {
    return this.guardar<Laboratorio>('laboratorios', datos, id);
  }

  desactivarLaboratorio(id: number): Observable<RespuestaApi<Laboratorio>> {
    return this.http.delete<RespuestaApi<Laboratorio>>(`${this.base}/laboratorios/${id}`);
  }

  listarBancos(soloActivos = false): Observable<Banco[]> {
    return this.listar<Banco>('bancos', soloActivos ? { solo_activos: 1 } : {});
  }

  guardarBanco(datos: Partial<Banco>, id?: number): Observable<Banco> {
    return this.guardar<Banco>('bancos', datos, id);
  }

  desactivarBanco(id: number): Observable<RespuestaApi<Banco>> {
    return this.http.delete<RespuestaApi<Banco>>(`${this.base}/bancos/${id}`);
  }

  // --------------------------------------------------- Elementos y líneas

  listarElementos(): Observable<Elemento[]> {
    return this.listar<Elemento>('elementos');
  }

  guardarElemento(datos: Partial<Elemento>, id?: number): Observable<Elemento> {
    return this.guardar<Elemento>('elementos', datos, id);
  }

  listarLineas(): Observable<LineaProducto[]> {
    return this.listar<LineaProducto>('lineas');
  }

  guardarLinea(datos: Partial<LineaProducto>, id?: number): Observable<LineaProducto> {
    return this.guardar<LineaProducto>('lineas', datos, id);
  }

  // ------------------------------------------------------------- Comunes

  private listar<T>(ruta: string, params: Record<string, string | number> = {}): Observable<T[]> {
    return this.http
      .get<RespuestaApi<T[]>>(`${this.base}/${ruta}`, { params })
      .pipe(map((r) => r.data));
  }

  private guardar<T>(ruta: string, datos: unknown, id?: number): Observable<T> {
    const peticion = id
      ? this.http.put<RespuestaApi<T>>(`${this.base}/${ruta}/${id}`, datos)
      : this.http.post<RespuestaApi<T>>(`${this.base}/${ruta}`, datos);
    return peticion.pipe(map((r) => r.data));
  }

  private cuerpo(archivo: File): FormData {
    const datos = new FormData();
    datos.append('archivo', archivo);
    return datos;
  }
}
