import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Caja, CajaOperacion, Concepto, DatosCaja, DatosMovimiento, Moneda, Movimiento, OpcionesCaja, Pagina,
  Persona, PersonaCorta, PersonaDetalle, SaldoSesion, SesionAbierta, UsuarioCorto, VistaPreviaComprobante,
  DatosCierre, FiltrosLibro, LibroCaja, SesionDetalle, SesionFila, DatosSolicitud, FormaPago, OpcionesSolicitud,
  SolicitudConUsuarios, AjusteMovimiento,
} from './caja.model';

interface Respuesta<T> { data: T; mensaje?: string; }

@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/caja`;

  /**
   * Listas para los formularios. Se piden cada vez que se abre la pantalla
   * (no se guardan en memoria): así un concepto o un banco recién creado
   * aparece sin tener que recargar el navegador.
   */
  opciones(): Observable<OpcionesCaja> {
    return this.http.get<Respuesta<OpcionesCaja>>(`${this.base}/opciones`).pipe(map((r) => r.data));
  }

  // ------------------------------------------------------------ Cajas
  listar(): Observable<Caja[]> {
    return this.http.get<Respuesta<Caja[]>>(`${this.base}/cajas`).pipe(map((r) => r.data));
  }

  ver(id: number): Observable<CajaOperacion> {
    return this.http.get<Respuesta<CajaOperacion>>(`${this.base}/cajas/${id}`).pipe(map((r) => r.data));
  }

  guardar(datos: DatosCaja, id?: number): Observable<Caja> {
    const pedido = id
      ? this.http.put<Respuesta<Caja>>(`${this.base}/cajas/${id}`, datos)
      : this.http.post<Respuesta<Caja>>(`${this.base}/cajas`, datos);
    return pedido.pipe(map((r) => r.data));
  }

  /** Cómo saldrá el próximo comprobante. No guarda ni consume números. */
  vistaPrevia(datos: Partial<DatosCaja> & { caja_id?: number | null }): Observable<VistaPreviaComprobante> {
    return this.http
      .post<Respuesta<VistaPreviaComprobante>>(`${this.base}/cajas/vista-previa`, datos)
      .pipe(map((r) => r.data));
  }

  /** Reemplaza la lista de cajeros asignados a la caja. */
  guardarCajeros(cajaId: number, usuarios: number[]): Observable<UsuarioCorto[]> {
    return this.http.put<Respuesta<UsuarioCorto[]>>(`${this.base}/cajas/${cajaId}/cajeros`, { usuarios })
      .pipe(map((r) => r.data));
  }

  /** Reemplaza la lista de aprobadores de la caja. */
  guardarAprobadores(cajaId: number, usuarios: number[]): Observable<UsuarioCorto[]> {
    return this.http.put<Respuesta<UsuarioCorto[]>>(`${this.base}/cajas/${cajaId}/aprobadores`, { usuarios })
      .pipe(map((r) => r.data));
  }

  // -------------------------------------------------------- Solicitudes
  opcionesSolicitud(): Observable<OpcionesSolicitud> {
    return this.http.get<Respuesta<OpcionesSolicitud>>(`${this.base}/solicitudes/opciones`).pipe(map((r) => r.data));
  }

  misSolicitudes(): Observable<SolicitudConUsuarios[]> {
    return this.http.get<Respuesta<SolicitudConUsuarios[]>>(`${this.base}/solicitudes/mias`).pipe(map((r) => r.data));
  }

  porAprobar(estado: 'PENDIENTE' | 'RESUELTAS'): Observable<{ data: SolicitudConUsuarios[]; ajustes: AjusteMovimiento[]; cajas: { id: number; codigo: string; nombre: string }[] }> {
    return this.http.get<{ data: SolicitudConUsuarios[]; ajustes: AjusteMovimiento[]; cajas: { id: number; codigo: string; nombre: string }[] }>(
      `${this.base}/solicitudes/por-aprobar`, { params: { estado } });
  }

  solicitudesDeCaja(cajaId: number, estado = 'APROBADA'): Observable<SolicitudConUsuarios[]> {
    return this.http.get<Respuesta<SolicitudConUsuarios[]>>(`${this.base}/cajas/${cajaId}/solicitudes`, { params: { estado } })
      .pipe(map((r) => r.data));
  }

  solicitar(datos: DatosSolicitud): Observable<Respuesta<SolicitudConUsuarios>> {
    return this.http.post<Respuesta<SolicitudConUsuarios>>(`${this.base}/solicitudes`, datos);
  }

  aprobarSolicitud(id: number, observacion: string | null): Observable<Respuesta<SolicitudConUsuarios>> {
    return this.http.post<Respuesta<SolicitudConUsuarios>>(`${this.base}/solicitudes/${id}/aprobar`, { observacion });
  }

  rechazarSolicitud(id: number, observacion: string): Observable<Respuesta<SolicitudConUsuarios>> {
    return this.http.post<Respuesta<SolicitudConUsuarios>>(`${this.base}/solicitudes/${id}/rechazar`, { observacion });
  }

  anularSolicitud(id: number, motivo: string): Observable<Respuesta<SolicitudConUsuarios>> {
    return this.http.post<Respuesta<SolicitudConUsuarios>>(`${this.base}/solicitudes/${id}/anular`, { motivo });
  }

  // ------------------------------------------------ Comprobantes provisionales
  ajustarMovimiento(id: number, datos: { monto: number; motivo: string; documento: string | null }):
      Observable<Respuesta<Movimiento> & { ajuste: AjusteMovimiento; saldos: SaldoSesion[] }> {
    return this.http.post<Respuesta<Movimiento> & { ajuste: AjusteMovimiento; saldos: SaldoSesion[] }>(
      `${this.base}/movimientos/${id}/ajustes`, datos);
  }

  aplicarAjuste(id: number): Observable<Respuesta<Movimiento> & { saldos: SaldoSesion[] }> {
    return this.http.post<Respuesta<Movimiento> & { saldos: SaldoSesion[] }>(`${this.base}/ajustes/${id}/aplicar`, {});
  }

  validarMovimiento(id: number): Observable<Respuesta<Movimiento> & { saldos: SaldoSesion[] }> {
    return this.http.post<Respuesta<Movimiento> & { saldos: SaldoSesion[] }>(`${this.base}/movimientos/${id}/validar`, {});
  }

  aprobarAjuste(id: number, observacion: string | null): Observable<Respuesta<AjusteMovimiento>> {
    return this.http.post<Respuesta<AjusteMovimiento>>(`${this.base}/ajustes/${id}/aprobar`, { observacion });
  }

  rechazarAjuste(id: number, observacion: string): Observable<Respuesta<AjusteMovimiento>> {
    return this.http.post<Respuesta<AjusteMovimiento>>(`${this.base}/ajustes/${id}/rechazar`, { observacion });
  }

  pagarSolicitud(id: number, pago: { forma_pago: FormaPago; banco_id?: number | null; nro_documento?: string | null; provisional?: boolean }):
      Observable<Respuesta<Movimiento> & { saldos: SaldoSesion[] }> {
    return this.http.post<Respuesta<Movimiento> & { saldos: SaldoSesion[] }>(`${this.base}/solicitudes/${id}/pagar`, pago);
  }

  // ---------------------------------------------------------- Personas
  personas(buscar: string, pagina = 1): Observable<Pagina<Persona>> {
    return this.http.get<Pagina<Persona>>(`${this.base}/personas`, { params: { buscar, page: pagina } });
  }

  /** Autocompletado: pocas personas activas que coinciden por nombre o CI. */
  buscarPersonas(texto: string): Observable<PersonaCorta[]> {
    return this.http.get<Respuesta<PersonaCorta[]>>(`${this.base}/personas`, { params: { buscar: texto, limite: 10 } })
      .pipe(map((r) => r.data));
  }

  /** ¿Ese nombre ya existe con otro CI, o ese CI es de otra persona? */
  coincidencias(nombre: string, ci: string | null): Observable<{ mismo_nombre: PersonaCorta[]; mismo_ci: PersonaCorta | null }> {
    return this.http.get<Respuesta<{ mismo_nombre: PersonaCorta[]; mismo_ci: PersonaCorta | null }>>(
      `${this.base}/personas/coincidencias`, { params: { nombre, ci: ci ?? '' } }).pipe(map((r) => r.data));
  }

  /** Pasa los movimientos de una persona duplicada a la que se conserva. */
  unificar(origenId: number, destinoId: number, motivo: string | null): Observable<Respuesta<Persona>> {
    return this.http.post<Respuesta<Persona>>(`${this.base}/personas/${origenId}/unificar`,
      { destino_id: destinoId, motivo });
  }

  persona(id: number): Observable<PersonaDetalle> {
    return this.http.get<Respuesta<PersonaDetalle>>(`${this.base}/personas/${id}`).pipe(map((r) => r.data));
  }

  guardarPersona(id: number, datos: Partial<Persona>): Observable<Persona> {
    return this.http.put<Respuesta<Persona>>(`${this.base}/personas/${id}`, datos).pipe(map((r) => r.data));
  }

  // --------------------------------------------------------- Conceptos
  conceptos(): Observable<Concepto[]> {
    return this.http.get<Respuesta<Concepto[]>>(`${this.base}/conceptos`).pipe(map((r) => r.data));
  }

  guardarConcepto(datos: Partial<Concepto>, id?: number): Observable<Concepto> {
    const pedido = id
      ? this.http.put<Respuesta<Concepto>>(`${this.base}/conceptos/${id}`, datos)
      : this.http.post<Respuesta<Concepto>>(`${this.base}/conceptos`, datos);
    return pedido.pipe(map((r) => r.data));
  }

  // ---------------------------------------------------------- Operación
  abrir(cajaId: number, saldoInicial: Partial<Record<Moneda, number | null>>): Observable<Respuesta<SesionAbierta>> {
    return this.http.post<Respuesta<SesionAbierta>>(`${this.base}/cajas/${cajaId}/sesiones`, { saldo_inicial: saldoInicial });
  }

  registrar(sesionId: number, datos: DatosMovimiento): Observable<Respuesta<Movimiento> & { saldos: SaldoSesion[] }> {
    return this.http.post<Respuesta<Movimiento> & { saldos: SaldoSesion[] }>(
      `${this.base}/sesiones/${sesionId}/movimientos`, datos);
  }

  anular(movimientoId: number, motivo: string): Observable<Respuesta<Movimiento> & { saldos: SaldoSesion[] }> {
    return this.http.post<Respuesta<Movimiento> & { saldos: SaldoSesion[] }>(
      `${this.base}/movimientos/${movimientoId}/anular`, { motivo });
  }

  comprobante(movimientoId: number): Observable<Blob> {
    return this.http.get(`${this.base}/movimientos/${movimientoId}/comprobante`, { responseType: 'blob' });
  }

  // ------------------------------------------------------------ Cierre
  sesion(id: number): Observable<SesionDetalle> {
    return this.http.get<Respuesta<SesionDetalle>>(`${this.base}/sesiones/${id}`).pipe(map((r) => r.data));
  }

  cerrar(sesionId: number, datos: DatosCierre): Observable<Respuesta<SesionDetalle>> {
    return this.http.post<Respuesta<SesionDetalle>>(`${this.base}/sesiones/${sesionId}/cerrar`, datos);
  }

  validar(sesionId: number): Observable<Respuesta<SesionFila>> {
    return this.http.post<Respuesta<SesionFila>>(`${this.base}/sesiones/${sesionId}/validar`, {});
  }

  sesiones(filtros: Record<string, string | number>, pagina = 1): Observable<Pagina<SesionFila>> {
    return this.http.get<Pagina<SesionFila>>(`${this.base}/sesiones`, { params: { ...filtros, page: pagina } });
  }

  reporteSesion(sesionId: number): Observable<Blob> {
    return this.http.get(`${this.base}/sesiones/${sesionId}/reporte`, { responseType: 'blob' });
  }

  // ------------------------------------------------------- Libro de caja
  libro(filtros: FiltrosLibro): Observable<LibroCaja> {
    return this.http.get<Respuesta<LibroCaja>>(`${this.base}/libro`, { params: this.parametros(filtros) }).pipe(map((r) => r.data));
  }

  libroArchivo(filtros: FiltrosLibro, formato: 'pdf' | 'excel'): Observable<Blob> {
    return this.http.get(`${this.base}/libro/${formato}`, { params: this.parametros(filtros), responseType: 'blob' });
  }

  private parametros(f: FiltrosLibro): Record<string, string> {
    const p: Record<string, string> = { desde: f.desde, hasta: f.hasta, moneda: f.moneda ?? 'BOB' };
    if (f.caja_id) p['caja_id'] = String(f.caja_id);
    if (f.concepto_id) p['concepto_id'] = String(f.concepto_id);
    if (f.incluir_anulados) p['incluir_anulados'] = '1';
    return p;
  }
}
