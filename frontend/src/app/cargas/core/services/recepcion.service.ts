import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BonoCalculado, BonoPendiente, CampoDisponible, DatosPesaje, DatosRecepcion, FotoRecepcion, LecturaTicket, Lote, Pagina, Pesaje,
  PlantillaBascula, RecuadroPlantilla, RespuestaApi, TablaTramos, TipoFoto, Tramo,
} from '../models/cargas.model';

export interface ListaPlantillas { data: PlantillaBascula[]; campos: CampoDisponible[]; ocr: boolean; }

export interface FiltroLotes { buscar?: string; estado?: string | null; serie_id?: number | null; desde?: string; hasta?: string; page?: number; }

@Injectable({ providedIn: 'root' })
export class RecepcionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/cargas`;

  listar(f: FiltroLotes): Observable<Pagina<Lote>> {
    const params: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(f)) if (v !== null && v !== undefined && v !== '') params[k] = v as string | number;
    return this.http.get<Pagina<Lote>>(`${this.base}/lotes`, { params });
  }

  ver(id: number): Observable<Lote> {
    return this.http.get<RespuestaApi<Lote>>(`${this.base}/lotes/${id}`).pipe(map((r) => r.data));
  }

  recibir(datos: DatosRecepcion): Observable<RespuestaApi<Lote> & { mensaje: string }> {
    return this.http.post<RespuestaApi<Lote> & { mensaje: string }>(`${this.base}/lotes`, datos);
  }

  anular(id: number, motivo: string): Observable<RespuestaApi<Lote> & { mensaje: string }> {
    return this.http.post<RespuestaApi<Lote> & { mensaje: string }>(`${this.base}/lotes/${id}/anular`, { motivo });
  }

  boleta(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/lotes/${id}/boleta`, { responseType: 'blob' });
  }

  rotulo(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/lotes/${id}/rotulo`, { responseType: 'blob' });
  }

  agregarPesaje(loteId: number, datos: DatosPesaje): Observable<RespuestaApi<Pesaje> & { mensaje: string }> {
    return this.http.post<RespuestaApi<Pesaje> & { mensaje: string }>(`${this.base}/lotes/${loteId}/pesajes`, datos);
  }

  corregirPesoCliente(id: number, kg: number | null, tipo: 'NETO' | 'BRUTO', motivo: string): Observable<RespuestaApi<Pesaje> & { mensaje: string }> {
    return this.http.post<RespuestaApi<Pesaje> & { mensaje: string }>(`${this.base}/pesajes/${id}/peso-cliente`,
      { peso_cliente_kg: kg, peso_cliente_tipo: tipo, motivo });
  }

  anularPesaje(id: number, motivo: string): Observable<RespuestaApi<Pesaje> & { mensaje: string }> {
    return this.http.post<RespuestaApi<Pesaje> & { mensaje: string }>(`${this.base}/pesajes/${id}/anular`, { motivo });
  }

  // --------------------------------------------------------------- Bono
  tramos(): Observable<TablaTramos[]> {
    return this.http.get<RespuestaApi<TablaTramos[]>>(`${this.base}/bono-tramos`).pipe(map((r) => r.data));
  }

  publicarTramos(vigenteDesde: string, tramos: Tramo[]): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.base}/bono-tramos`, { vigente_desde: vigenteDesde, tramos });
  }

  calcularBono(pesoNetoKg: number): Observable<BonoCalculado | null> {
    return this.http.get<RespuestaApi<BonoCalculado | null>>(`${this.base}/bono-tramos/calcular`, { params: { peso_neto_kg: pesoNetoKg } })
      .pipe(map((r) => r.data));
  }

  bonosPendientes(cajaId: number): Observable<BonoPendiente[]> {
    return this.http.get<RespuestaApi<BonoPendiente[]>>(`${this.base}/bonos/pendientes`, { params: { caja_id: cajaId } })
      .pipe(map((r) => r.data));
  }

  pagarBono(bonoId: number, cajaId: number): Observable<RespuestaApi<{ id: number; numero: string }> & { mensaje: string }> {
    return this.http.post<RespuestaApi<{ id: number; numero: string }> & { mensaje: string }>(
      `${this.base}/bonos/${bonoId}/pagar`, { caja_id: cajaId });
  }

  // --------------------------------------------------------------- Fotos y plantillas
  plantillas(soloActivas = false): Observable<ListaPlantillas> {
    return this.http.get<ListaPlantillas>(`${this.base}/plantillas-bascula`, { params: soloActivas ? { solo_activas: 1 } : {} });
  }

  guardarPlantilla(id: number | null, datos: Omit<PlantillaBascula, 'id' | 'tiene_muestra'>, muestra: Blob | null)
    : Observable<RespuestaApi<PlantillaBascula> & { mensaje: string }> {
    const f = new FormData();
    f.append('nombre', datos.nombre);
    f.append('bascula', datos.bascula);
    f.append('uso', datos.uso);
    f.append('proporcion', String(datos.proporcion));
    f.append('activa', datos.activa ? '1' : '0');
    f.append('campos', JSON.stringify(datos.campos));
    if (muestra) f.append('muestra', muestra, 'muestra.jpg');
    const url = id ? `${this.base}/plantillas-bascula/${id}` : `${this.base}/plantillas-bascula`;
    return this.http.post<RespuestaApi<PlantillaBascula> & { mensaje: string }>(url, f);
  }

  muestraPlantilla(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/plantillas-bascula/${id}/muestra`, { responseType: 'blob' });
  }

  probarPlantilla(imagen: Blob, campos: RecuadroPlantilla[]): Observable<LecturaTicket> {
    const f = new FormData();
    f.append('imagen', imagen, 'prueba.jpg');
    f.append('campos', JSON.stringify(campos));
    return this.http.post<RespuestaApi<LecturaTicket>>(`${this.base}/plantillas-bascula/probar`, f).pipe(map((r) => r.data));
  }

  subirFoto(tipo: TipoFoto, imagen: Blob, original: Blob | null, plantillaId: number | null): Observable<FotoRecepcion> {
    const f = new FormData();
    f.append('tipo', tipo);
    f.append('imagen', imagen, 'foto.jpg');
    if (original) f.append('original', original, 'original.jpg');
    if (plantillaId) f.append('plantilla_id', String(plantillaId));
    return this.http.post<RespuestaApi<FotoRecepcion>>(`${this.base}/fotos`, f).pipe(map((r) => r.data));
  }

  foto(id: number, original = false): Observable<Blob> {
    return this.http.get(`${this.base}/fotos/${id}`, { responseType: 'blob', params: original ? { original: 1 } : {} });
  }
}
