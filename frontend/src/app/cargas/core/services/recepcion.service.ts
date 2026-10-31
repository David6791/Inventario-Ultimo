import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BonoCalculado, BonoLabPendiente, BonoPendiente, JuegoReglas, PesoQueVale, ReglaPeso, TablaLaboratorio, TramoLaboratorio, CampoDisponible, DatosPesaje, DatosRecepcion, FotoRecepcion, LecturaTicket, LectorBoleta, Lote, Pagina, Pesaje,
  PlantillaBascula, ProductorParecido, RecuadroPlantilla, SedeRecepcion, RespuestaApi, TablaTramos, TipoFoto, Tramo,
} from '../models/cargas.model';

export interface ListaPlantillas { data: PlantillaBascula[]; campos: CampoDisponible[]; ocr: boolean; }

export interface FiltroResumen { desde: string; hasta: string; almacen_id?: number | null; serie_id?: number | null; material?: string | null; origen?: string | null; }
export interface FilaResumen { clave: string; nombre: string; lotes: number; kg: number; }
export interface ResumenCargas {
  totales: { lotes: number; kg: number; lotes_propios: number };
  por_acopio: FilaResumen[]; por_tipo: FilaResumen[]; por_material: FilaResumen[]; por_origen: FilaResumen[];
  produccion_propia: { mina: string | null; bocamina: string | null; lotes: number; kg: number }[];
  por_dia: { fecha: string; lotes: number; kg: number }[];
}
function limpio(f: object): Record<string, string | number> {
  const p: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(f)) if (v !== null && v !== undefined && v !== '') p[k] = v as string | number;
  return p;
}

export interface FiltroLotes {
  buscar?: string; estado?: string | null; serie_id?: number | null; desde?: string; hasta?: string; page?: number;
  almacen_id?: number | null; material?: string | null; origen?: string | null;
}

@Injectable({ providedIn: 'root' })
export class RecepcionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/cargas`;

  listar(f: FiltroLotes): Observable<Pagina<Lote>> {
    const params: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(f)) if (v !== null && v !== undefined && v !== '') params[k] = v as string | number;
    return this.http.get<Pagina<Lote>>(`${this.base}/lotes`, { params });
  }

  // --------------------------------------------------------- Clasificación
  resumen(f: FiltroResumen): Observable<ResumenCargas> {
    return this.http.get<RespuestaApi<ResumenCargas>>(`${this.base}/reportes/resumen`, { params: limpio(f) }).pipe(map((r) => r.data));
  }

  resumenArchivo(f: FiltroResumen, formato: 'pdf' | 'excel'): Observable<Blob> {
    return this.http.get(`${this.base}/reportes/resumen/${formato}`, { params: limpio(f), responseType: 'blob' });
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

  // --------------------------------------------------------------- Reglas de peso
  reglasPeso(): Observable<JuegoReglas[]> {
    return this.http.get<RespuestaApi<JuegoReglas[]>>(`${this.base}/reglas-peso`).pipe(map((r) => r.data));
  }

  publicarReglasPeso(vigenteDesde: string, reglas: ReglaPeso[]): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.base}/reglas-peso`, { vigente_desde: vigenteDesde, reglas });
  }

  probarFormula(formula: string, empresa: number, cliente: number): Observable<number> {
    return this.http.post<RespuestaApi<{ kg: number }>>(`${this.base}/reglas-peso/probar`, { formula, empresa, cliente }).pipe(map((r) => r.data.kg));
  }

  /** Peso que vale con las reglas vigentes: lo calcula la base, igual que al guardar. */
  pesoQueVale(empresa: number, cliente: number | null): Observable<PesoQueVale> {
    const params: Record<string, number> = { empresa };
    if (cliente) params['cliente'] = cliente;
    return this.http.get<RespuestaApi<PesoQueVale>>(`${this.base}/reglas-peso/calcular`, { params }).pipe(map((r) => r.data));
  }

  // --------------------------------------------------------------- Bono de laboratorio
  tablasLaboratorio(): Observable<TablaLaboratorio[]> {
    return this.http.get<RespuestaApi<TablaLaboratorio[]>>(`${this.base}/bono-laboratorio-tramos`).pipe(map((r) => r.data));
  }

  publicarTablaLaboratorio(vigenteDesde: string, tramos: TramoLaboratorio[]): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.base}/bono-laboratorio-tramos`, { vigente_desde: vigenteDesde, tramos });
  }

  bonoLaboratorioPara(material: string): Observable<{ num_elementos: number; monto: string; moneda: string } | null> {
    return this.http.get<RespuestaApi<{ num_elementos: number; monto: string; moneda: string } | null>>(
      `${this.base}/bono-laboratorio-tramos/calcular`, { params: { material } }).pipe(map((r) => r.data));
  }

  bonosLaboratorioPendientes(cajaId: number): Observable<BonoLabPendiente[]> {
    return this.http.get<RespuestaApi<BonoLabPendiente[]>>(`${this.base}/bonos-laboratorio/pendientes`, { params: { caja_id: cajaId } })
      .pipe(map((r) => r.data));
  }

  pagarBonoLaboratorio(bonoId: number, cajaId: number, nombre: string, ci: string | null):
      Observable<RespuestaApi<{ id: number; numero: string }> & { mensaje: string }> {
    return this.http.post<RespuestaApi<{ id: number; numero: string }> & { mensaje: string }>(
      `${this.base}/bonos-laboratorio/${bonoId}/pagar`, { caja_id: cajaId, beneficiario_nombre: nombre, beneficiario_ci: ci });
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

  probarPlantilla(imagen: Blob, campos: RecuadroPlantilla[], lector: LectorBoleta = 'tesseract'): Observable<LecturaTicket> {
    const f = new FormData();
    f.append('imagen', imagen, 'prueba.jpg');
    f.append('campos', JSON.stringify(campos));
    f.append('lector', lector);
    return this.http.post<RespuestaApi<LecturaTicket>>(`${this.base}/plantillas-bascula/probar`, f).pipe(map((r) => r.data));
  }

  subirFoto(tipo: TipoFoto, imagen: Blob, original: Blob | null, plantillaId: number | null,
            lector: LectorBoleta = 'tesseract'): Observable<FotoRecepcion> {
    const f = new FormData();
    f.append('tipo', tipo);
    if (tipo !== 'BALANZA_MANUAL') f.append('lector', lector);
    f.append('imagen', imagen, 'foto.jpg');
    if (original) f.append('original', original, 'original.jpg');
    if (plantillaId) f.append('plantilla_id', String(plantillaId));
    return this.http.post<RespuestaApi<FotoRecepcion>>(`${this.base}/fotos`, f).pipe(map((r) => r.data));
  }

  foto(id: number, original = false): Observable<Blob> {
    return this.http.get(`${this.base}/fotos/${id}`, { responseType: 'blob', params: original ? { original: 1 } : {} });
  }

  /** Productores cuyo nombre se parece al leído de la boleta (palabras en cualquier orden). */
  productoresParecidos(nombre: string): Observable<ProductorParecido[]> {
    return this.http.get<RespuestaApi<ProductorParecido[]>>(`${this.base}/productores/parecidos`, { params: { nombre } })
      .pipe(map((r) => r.data));
  }

  // --------------------------------------------------------------- Sedes de recepción
  sedesRecepcion(): Observable<{ data: SedeRecepcion[]; candidatos: { id: number; name: string; email: string }[] }> {
    return this.http.get<{ data: SedeRecepcion[]; candidatos: { id: number; name: string; email: string }[] }>(`${this.base}/sedes-recepcion`);
  }

  asignarRecepcionistas(almacenId: number, usuarios: number[]): Observable<RespuestaApi<SedeRecepcion> & { mensaje: string }> {
    return this.http.put<RespuestaApi<SedeRecepcion> & { mensaje: string }>(`${this.base}/sedes-recepcion/${almacenId}`, { usuarios });
  }
}
