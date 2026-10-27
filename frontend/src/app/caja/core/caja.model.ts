export type Moneda = 'BOB' | 'USD';
export type FormaPago = 'EFECTIVO' | 'CHEQUE' | 'TRANSFERENCIA';
export type TipoMovimiento = 'INGRESO' | 'EGRESO';
export type Reinicio = 'NUNCA' | 'ANUAL' | 'MENSUAL' | 'DIARIO';

export interface Opcion<T = string> { valor: T; etiqueta: string; }

export interface AlmacenCorto { id: number; codigo: string; nombre: string; }

export interface OpcionesCaja {
  almacenes: AlmacenCorto[];
  /** Candidatos a cajero (solo llega a quien administra cajas). */
  usuarios: { id: number; name: string; email: string }[];
  bancos: { id: number; nombre: string }[];
  monedas: Opcion<Moneda>[];
  formas_pago: Opcion<FormaPago>[];
  tipos: Opcion<TipoMovimiento>[];
  reinicios: Opcion<Reinicio>[];
  marcadores: { marcador: string; descripcion: string }[];
  denominaciones: Record<Moneda, number[]>;
  conceptos: { id: number; codigo: string; nombre: string; tipo: TipoMovimiento; exento_aprobacion: boolean }[];
  /** Candidatos a aprobador (usuarios con caja.aprobar; solo llega a quien administra cajas). */
  aprobadores: { id: number; name: string; email: string }[];
}

/** Una fila de caja.v_sesion_resumen (los montos llegan como texto decimal). */
export interface SaldoSesion {
  sesion_id: number;
  moneda: Moneda;
  saldo_inicial: string;
  ingresos_efectivo: string;
  egresos_efectivo: string;
  ingresos_no_efectivo: string;
  egresos_no_efectivo: string;
  saldo_efectivo_actual: string;
  saldo_esperado: string | null;
  saldo_contado: string | null;
  diferencia: string | null;
}

export interface Concepto {
  id: number;
  codigo: string;
  nombre: string;
  tipo: TipoMovimiento;
  origen: string;
  activo: boolean;
  /** Egreso que se registra directo aun en cajas con aprobación (por ejemplo, depósito en banco). */
  exento_aprobacion?: boolean;
  movimientos?: number;
}

/** Usuario tal como lo serializa Laravel al cargar la relación. */
export interface UsuarioCorto { id: number; name: string; }

export interface Movimiento {
  id: number;
  numero: string;
  fecha: string;
  tipo: TipoMovimiento;
  concepto_id: number;
  concepto?: Pick<Concepto, 'id' | 'codigo' | 'nombre' | 'tipo' | 'origen'>;
  monto: string;
  moneda: Moneda;
  forma_pago: FormaPago;
  banco?: { id: number; nombre: string } | null;
  nro_documento: string | null;
  persona_id: number | null;
  persona?: PersonaCorta | null;
  persona_nombre: string;
  persona_ci: string | null;
  glosa: string;
  estado: 'VIGENTE' | 'ANULADO';
  /** Con la relación cargada, Laravel reemplaza el id por el usuario. */
  registrado_por: UsuarioCorto | number;
  anulado_por: UsuarioCorto | number | null;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  /** Egreso a rendir en el día: su monto se ajusta hasta validarlo. */
  provisional?: boolean;
  validado_por?: UsuarioCorto | number | null;
  validado_en?: string | null;
  ajustes?: AjusteMovimiento[];
}

export type EstadoAjuste = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'APLICADO' | 'ANULADO';

/** Ajuste del monto de un comprobante provisional. */
export interface AjusteMovimiento {
  id: number;
  movimiento_id: number;
  monto_anterior: string;
  monto_nuevo: string;
  motivo: string;
  documento: string | null;
  estado: EstadoAjuste;
  registrado_por: UsuarioCorto | number;
  registrado_en: string;
  resuelto_por: UsuarioCorto | number | null;
  resuelto_en: string | null;
  observacion: string | null;
  aplicado_por: UsuarioCorto | number | null;
  aplicado_en: string | null;
  /** Solo en la bandeja del aprobador. */
  movimiento?: Pick<Movimiento, 'id' | 'numero' | 'monto' | 'moneda' | 'persona_nombre' | 'persona_ci' | 'glosa'>
    & { caja?: { id: number; codigo: string }; concepto?: { id: number; nombre: string } };
  es_mio?: boolean;
}

export interface SesionAbierta {
  id: number;
  numero: number;
  abierta_en: string;
  abierta_por: string | null;
  saldos: SaldoSesion[];
  movimientos?: Movimiento[];
}

export interface PersonaCorta { id: number; nombre: string; ci: string | null; }

export interface TotalPersona {
  moneda: Moneda;
  movimientos: number;
  total_ingresos: string;
  total_egresos: string;
  ultimo_movimiento: string | null;
}

export interface Persona extends PersonaCorta {
  telefono: string | null;
  observaciones: string | null;
  activo: boolean;
  movimientos: number;
  /** Otras personas registradas con el mismo nombre: posible duplicado. */
  homonimos: number;
  totales: TotalPersona[];
}

export interface PersonaDetalle extends Omit<Persona, 'movimientos'> {
  movimientos: (Movimiento & { caja?: { id: number; codigo: string; nombre: string } })[];
}

export interface Pagina<T> { data: T[]; total: number; current_page: number; per_page: number; }

export interface Caja {
  id: number;
  codigo: string;
  nombre: string;
  almacen_id: number;
  almacen?: AlmacenCorto;
  maneja_usd: boolean;
  formato_comprobante: string;
  reinicio_comprobante: Reinicio;
  activa: boolean;
  /** Los egresos manuales salen solo de una solicitud aprobada. */
  requiere_aprobacion: boolean;
  tiene_sesiones?: boolean;
  proximo_numero?: string | null;
  /** Último correlativo emitido en el período actual (0 si ninguno). */
  ultimo_correlativo?: number;
  /** Ingresos y egresos con correlativo propio. */
  numeracion_separada?: boolean;
  inicio_egreso?: number;
  inicio_ingreso?: number;
  formato_ingreso?: string | null;
  ultimo_correlativo_ingreso?: number | null;
  proximo_numero_ingreso?: string | null;
  solicitudes_por_pagar?: number;
  cajeros?: UsuarioCorto[];
  aprobadores?: UsuarioCorto[];
  /** Si el usuario que mira está asignado: solo entonces opera la caja. */
  soy_cajero?: boolean;
  sesion_abierta: SesionAbierta | null;
}

export interface CajaOperacion extends Caja {
  saldos_arranque: Partial<Record<Moneda, string | null>>;
  ultima_cerrada: { id: number; numero: number; estado: string; cerrada_en: string; cerrada_por: string | null } | null;
}

export interface VistaPreviaComprobante {
  numero: string | null; repetido: boolean; error: string | null;
  /** Con numeración separada: cómo saldrá el próximo ingreso. */
  ingreso?: { numero: string | null; repetido: boolean; error: string | null };
}

export interface DatosCaja {
  codigo: string;
  nombre: string;
  almacen_id: number;
  maneja_usd: boolean;
  formato_comprobante: string;
  reinicio_comprobante: Reinicio;
  activa: boolean;
  requiere_aprobacion: boolean;
  /** Desde qué número sigue el comprobante; solo se manda si cambia. */
  proximo_comprobante?: number | null;
  numeracion_separada?: boolean;
  inicio_egreso?: number;
  inicio_ingreso?: number;
  formato_ingreso?: string | null;
  proximo_ingreso?: number | null;
  motivo_numeracion?: string | null;
}

export type EstadoSolicitud = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'PAGADA' | 'ANULADA';

/** Solicitud de dinero de una caja con aprobación. */
export interface Solicitud {
  id: number;
  numero: string;
  caja_id: number;
  caja?: { id: number; codigo: string; nombre: string };
  concepto_id: number;
  concepto?: { id: number; codigo: string; nombre: string };
  monto: string;
  moneda: Moneda;
  persona_id: number;
  persona_nombre: string;
  persona_ci: string | null;
  glosa: string;
  estado: EstadoSolicitud;
  registrado_por: number;
  registrado_en: string;
  resuelto_en: string | null;
  observacion: string | null;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  movimiento_id: number | null;
  movimiento?: { id: number; numero: string; estado: string; fecha: string } | null;
  resuelto_por: number | null;
  anulado_por: number | null;
  /** Solo en la bandeja del aprobador: la registró él o es a su nombre (no la puede aprobar). */
  es_mia?: boolean;
}

/** Nombres de usuario de las relaciones registradoPor, resueltoPor, anuladoPor. */
export interface SolicitudConUsuarios extends Omit<Solicitud, 'registrado_por' | 'resuelto_por' | 'anulado_por'> {
  registrado_por: UsuarioCorto | number;
  resuelto_por: UsuarioCorto | number | null;
  anulado_por: UsuarioCorto | number | null;
}

export interface OpcionesSolicitud {
  cajas: { id: number; codigo: string; nombre: string; sede: string | null; monedas: Moneda[]; soy_cajero: boolean }[];
  conceptos: { id: number; codigo: string; nombre: string }[];
  puede_a_nombre_de: boolean;
  puede_solicitar: boolean;
}

export interface DatosSolicitud {
  caja_id: number;
  concepto_id: number;
  monto: number;
  moneda: Moneda;
  glosa: string;
  persona_id?: number | null;
  persona_nombre?: string | null;
  persona_ci?: string | null;
}

export interface DatosMovimiento {
  concepto_id: number;
  monto: number;
  moneda: Moneda;
  forma_pago: FormaPago;
  banco_id: number | null;
  nro_documento: string | null;
  persona_id: number | null;
  persona_nombre: string | null;
  persona_ci: string | null;
  glosa: string;
  provisional?: boolean;
}

// ------------------------------------------------------------ Cierre (sprint 3)

export type EstadoSesion = 'ABIERTA' | 'CERRADA' | 'VALIDADA';

export interface CorteArqueo { moneda: Moneda; denominacion: string; cantidad: number; subtotal: string; }

export interface PorConcepto {
  moneda: Moneda; tipo: TipoMovimiento; concepto_codigo: string; concepto: string;
  movimientos: number; total: string; efectivo: string; otras_formas: string;
}

export interface SesionDetalle {
  id: number;
  numero: number;
  estado: EstadoSesion;
  caja: { id: number; codigo: string; nombre: string };
  caja_id: number;
  abierta_en: string;
  cerrada_en: string | null;
  validada_en: string | null;
  abierta_por: UsuarioCorto | number;
  cerrada_por: UsuarioCorto | number | null;
  validada_por: UsuarioCorto | number | null;
  observaciones: string | null;
  saldos: SaldoSesion[];
  arqueo: CorteArqueo[];
  por_concepto: PorConcepto[];
  denominaciones: Record<Moneda, number[]>;
  movimientos: Movimiento[];
}

export interface SesionFila {
  id: number;
  numero: number;
  estado: EstadoSesion;
  caja: { id: number; codigo: string; nombre: string };
  abierta_en: string;
  cerrada_en: string | null;
  validada_en: string | null;
  abierta_por: UsuarioCorto | number;
  cerrada_por: UsuarioCorto | number | null;
  validada_por: UsuarioCorto | number | null;
  observaciones: string | null;
  saldos: { moneda: Moneda; saldo_inicial: string; saldo_esperado: string | null; saldo_contado: string | null; diferencia: string | null }[];
}

export interface DatosCierre {
  monedas: Partial<Record<Moneda, { arqueo?: { denominacion: number; cantidad: number }[]; contado?: number | null }>>;
  observaciones: string | null;
}

export interface FiltrosLibro {
  desde: string;
  hasta: string;
  caja_id?: number | null;
  concepto_id?: number | null;
  moneda?: Moneda;
  incluir_anulados?: boolean;
}

export interface LibroCaja {
  titulo: string;
  totales: {
    moneda: Moneda; movimientos: number; ingresos_efectivo: number; egresos_efectivo: number;
    ingresos_otras: number; egresos_otras: number; neto_efectivo: number;
  };
  por_concepto: { tipo: TipoMovimiento; concepto: string; movimientos: number; efectivo: number; otras: number; total: number }[];
  movimientos: {
    id: number; fecha: string; numero: string; caja: string; sesion: number; tipo: TipoMovimiento; concepto: string;
    persona: string; persona_ci: string | null; forma_pago: FormaPago; banco: string | null; documento: string | null;
    glosa: string; monto: string; estado: 'VIGENTE' | 'ANULADO';
  }[];
}
