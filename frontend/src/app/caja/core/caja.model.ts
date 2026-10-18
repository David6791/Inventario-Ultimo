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
  conceptos: { id: number; codigo: string; nombre: string; tipo: TipoMovimiento }[];
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
  tiene_sesiones?: boolean;
  proximo_numero?: string | null;
  cajeros?: UsuarioCorto[];
  /** Si el usuario que mira está asignado: solo entonces opera la caja. */
  soy_cajero?: boolean;
  sesion_abierta: SesionAbierta | null;
}

export interface CajaOperacion extends Caja {
  saldos_arranque: Partial<Record<Moneda, string | null>>;
  ultima_cerrada: { id: number; numero: number; estado: string; cerrada_en: string; cerrada_por: string | null } | null;
}

export interface VistaPreviaComprobante { numero: string | null; repetido: boolean; error: string | null; }

export interface DatosCaja {
  codigo: string;
  nombre: string;
  almacen_id: number;
  maneja_usd: boolean;
  formato_comprobante: string;
  reinicio_comprobante: Reinicio;
  activa: boolean;
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
}
