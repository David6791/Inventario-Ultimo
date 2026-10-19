import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ConceptoRetencion, Cotizacion, RespuestaApi, TablaPrecio, TramoPrecio, ValorLote } from '../models/cargas.model';

type ConMensaje<T> = RespuestaApi<T> & { mensaje: string };

export interface DatosTabla {
  linea_producto_id: number; elemento_id: number; moneda: string; factor_conversion: number | null;
  descripcion: string | null; vigente_desde: string; tramos: TramoPrecio[];
}

/** Tablas de precio, cotizaciones, retenciones y valor estimado del lote (sprint 6). */
@Injectable({ providedIn: 'root' })
export class PreciosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/cargas`;

  tablas(f: { linea_id?: number | null; elemento_id?: number | null; estado?: string | null } = {}): Observable<TablaPrecio[]> {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(f)) if (v !== null && v !== undefined && v !== '') params[k] = String(v);
    return this.http.get<RespuestaApi<TablaPrecio[]>>(`${this.base}/precios`, { params }).pipe(map((r) => r.data));
  }
  tabla(id: number): Observable<TablaPrecio> {
    return this.http.get<RespuestaApi<TablaPrecio>>(`${this.base}/precios/${id}`).pipe(map((r) => r.data));
  }
  guardar(datos: DatosTabla, id?: number): Observable<ConMensaje<TablaPrecio>> {
    return id ? this.http.put<ConMensaje<TablaPrecio>>(`${this.base}/precios/${id}`, datos)
              : this.http.post<ConMensaje<TablaPrecio>>(`${this.base}/precios`, datos);
  }
  copiar(id: number): Observable<ConMensaje<TablaPrecio>> { return this.http.post<ConMensaje<TablaPrecio>>(`${this.base}/precios/${id}/copiar`, {}); }
  aprobar(id: number): Observable<ConMensaje<TablaPrecio>> { return this.http.post<ConMensaje<TablaPrecio>>(`${this.base}/precios/${id}/aprobar`, {}); }
  anular(id: number): Observable<ConMensaje<TablaPrecio>> { return this.http.post<ConMensaje<TablaPrecio>>(`${this.base}/precios/${id}/anular`, {}); }
  eliminar(id: number): Observable<{ mensaje: string }> { return this.http.delete<{ mensaje: string }>(`${this.base}/precios/${id}`); }

  cotizaciones(f: { elemento_id?: number | null; anio?: number | null; tipo?: string | null } = {}): Observable<Cotizacion[]> {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(f)) if (v !== null && v !== undefined && v !== '') params[k] = String(v);
    return this.http.get<RespuestaApi<Cotizacion[]>>(`${this.base}/cotizaciones`, { params }).pipe(map((r) => r.data));
  }
  guardarCotizacion(datos: Partial<Cotizacion>, id?: number): Observable<ConMensaje<Cotizacion>> {
    return id ? this.http.put<ConMensaje<Cotizacion>>(`${this.base}/cotizaciones/${id}`, datos)
              : this.http.post<ConMensaje<Cotizacion>>(`${this.base}/cotizaciones`, datos);
  }
  eliminarCotizacion(id: number): Observable<{ mensaje: string }> { return this.http.delete<{ mensaje: string }>(`${this.base}/cotizaciones/${id}`); }

  retenciones(): Observable<ConceptoRetencion[]> {
    return this.http.get<RespuestaApi<ConceptoRetencion[]>>(`${this.base}/retenciones`).pipe(map((r) => r.data));
  }
  publicarTasa(datos: { concepto_id: number; cooperativa_id: number | null; porcentaje: number; vigente_desde: string }): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${this.base}/retenciones/tasas`, datos);
  }

  valorLote(loteId: number): Observable<ValorLote> {
    return this.http.get<RespuestaApi<ValorLote>>(`${this.base}/lotes/${loteId}/valor`).pipe(map((r) => r.data));
  }
}
