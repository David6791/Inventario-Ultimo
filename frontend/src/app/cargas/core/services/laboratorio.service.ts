import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Analisis, CriterioLey, DatosMuestra, FilaBandeja, LaboratorioLote, LeyFinal, Lote, Muestra, RespuestaApi, TipoAnalisis,
} from '../models/cargas.model';

type ConMensaje<T> = RespuestaApi<T> & { mensaje: string };

/** Muestreo, análisis, ley final y cierre del lote (sprint 5). */
@Injectable({ providedIn: 'root' })
export class LaboratorioService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/cargas`;

  bandeja(estado?: string | null): Observable<FilaBandeja[]> {
    const params: Record<string, string> = estado ? { estado } : {};
    return this.http.get<RespuestaApi<FilaBandeja[]>>(`${this.base}/laboratorio/bandeja`, { params }).pipe(map((r) => r.data));
  }

  ver(loteId: number): Observable<LaboratorioLote> {
    return this.http.get<RespuestaApi<LaboratorioLote>>(`${this.base}/lotes/${loteId}/laboratorio`).pipe(map((r) => r.data));
  }

  registrarMuestra(loteId: number, datos: DatosMuestra): Observable<ConMensaje<Muestra>> {
    return this.http.post<ConMensaje<Muestra>>(`${this.base}/lotes/${loteId}/muestras`, datos);
  }

  etiquetas(muestraId: number): Observable<Blob> {
    return this.http.get(`${this.base}/muestras/${muestraId}/etiquetas`, { responseType: 'blob' });
  }

  registrarAnalisis(muestraId: number, datos: {
    tipo: TipoAnalisis; laboratorio_id: number; numero_certificado: string; fecha_emision: string | null;
    resultados: { elemento_id: number; valor: number }[];
  }, certificado: File | null): Observable<ConMensaje<Analisis>> {
    const f = new FormData();
    f.append('tipo', datos.tipo);
    f.append('laboratorio_id', String(datos.laboratorio_id));
    f.append('numero_certificado', datos.numero_certificado);
    if (datos.fecha_emision) f.append('fecha_emision', datos.fecha_emision);
    f.append('resultados', JSON.stringify(datos.resultados));
    if (certificado) f.append('certificado', certificado);
    return this.http.post<ConMensaje<Analisis>>(`${this.base}/muestras/${muestraId}/analisis`, f);
  }

  adjuntarCertificado(analisisId: number, archivo: File): Observable<ConMensaje<Analisis>> {
    const f = new FormData();
    f.append('archivo', archivo);
    return this.http.post<ConMensaje<Analisis>>(`${this.base}/analisis/${analisisId}/certificado`, f);
  }

  certificado(analisisId: number): Observable<Blob> {
    return this.http.get(`${this.base}/analisis/${analisisId}/certificado`, { responseType: 'blob' });
  }

  anularAnalisis(analisisId: number, motivo: string): Observable<ConMensaje<Analisis>> {
    return this.http.post<ConMensaje<Analisis>>(`${this.base}/analisis/${analisisId}/anular`, { motivo });
  }

  fijarLey(loteId: number, elementoId: number, criterio: CriterioLey, valor: number | null, observacion: string | null): Observable<ConMensaje<LeyFinal>> {
    return this.http.put<ConMensaje<LeyFinal>>(`${this.base}/lotes/${loteId}/leyes/${elementoId}`, { criterio, valor, observacion });
  }

  cerrar(loteId: number): Observable<ConMensaje<Lote>> {
    return this.http.post<ConMensaje<Lote>>(`${this.base}/lotes/${loteId}/cerrar-analisis`, {});
  }

  reabrir(loteId: number, motivo: string): Observable<ConMensaje<Lote>> {
    return this.http.post<ConMensaje<Lote>>(`${this.base}/lotes/${loteId}/reabrir`, { motivo });
  }

  lecturaEstimada(loteId: number, metodo: string | null, lecturas: { elemento_id: number; valor: number | null }[]): Observable<{ mensaje: string }> {
    return this.http.put<{ mensaje: string }>(`${this.base}/lotes/${loteId}/lectura-estimada`, { metodo, lecturas });
  }
}
