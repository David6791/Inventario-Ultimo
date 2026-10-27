/** Respuestas y entidades del módulo de manejo de cargas (api/cargas). */

export interface RespuestaApi<T> {
  data: T;
  mensaje?: string;
}

export interface Pagina<T> {
  data: T[];
  current_page: number;
  per_page: number;
  total: number;
}

export interface Opcion {
  valor: string;
  etiqueta: string;
}

export interface Opciones {
  tipos_productor: Opcion[];
  departamentos: Opcion[];
  unidades_ley: Opcion[];
  unidades_cotizacion: Opcion[];
  formas: Opcion[];
  modalidades_precio: Opcion[];
  roles_elemento: Opcion[];
  origenes: Opcion[];
  reinicios: Opcion[];
  marcadores: Opcion[];
  estados_lote: Opcion[];
  materiales: Opcion[];
  almacenes: { id: number; codigo: string; nombre: string }[];
  almacen_predeterminado: number | null;
  /** Parámetro FOTO_TICKET_OBLIGATORIA. */
  foto_ticket_obligatoria?: boolean;
  /** Sedes donde este usuario recibe carga; con una sola asignada viene la fija. */
  sedes_recepcion?: { id: number; codigo: string; nombre: string }[];
  sede_recepcion_fija?: number | null;
  /** Hasta cuántos kg de diferencia (nuestra menor que la del cliente) se promedia. */
  limite_promedio_peso_kg?: number;
}

export type TipoProductor = 'COOPERATIVISTA' | 'PARTICULAR' | 'EMPRESA' | 'INGENIO';

export interface Referencia {
  id: number;
  nombre: string;
}

export interface Productor {
  id: number;
  tipo: TipoProductor;
  nombre: string;
  ci: string | null;
  nit: string | null;
  nim: string | null;
  telefono: string | null;
  domicilio: string | null;
  cooperativa_id: number | null;
  cooperativa?: Referencia | null;
  activo: boolean;
}

export interface Municipio {
  id: number;
  codigo: string | null;
  nombre: string;
  departamento: string;
  cooperativas_count?: number;
  minas_count?: number;
}

export interface Cooperativa {
  id: number;
  nombre: string;
  sigla: string | null;
  nit: string | null;
  nim: string | null;
  municipio_id: number | null;
  municipio?: Referencia | null;
  activa: boolean;
  productores_activos?: number;
  minas_activas?: number;
}

export interface Mina {
  id: number;
  nombre: string;
  propia: boolean;
  cooperativa_id: number | null;
  cooperativa?: Referencia | null;
  municipio_id: number | null;
  municipio?: Referencia | null;
  activa: boolean;
  bocaminas_activas?: number;
}

export interface Bocamina {
  id: number;
  mina_id: number;
  codigo: string;
  nombre: string | null;
  activa: boolean;
}

export interface Laboratorio {
  id: number;
  nombre: string;
  nit: string | null;
  propio: boolean;
  acreditado: boolean;
  activo: boolean;
}

export interface Banco {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Elemento {
  id: number;
  codigo: string;
  nombre: string;
  unidad_ley: string;
  unidad_cotizacion: string | null;
  activo: boolean;
  /** Con análisis, leyes, precios o cotizaciones: la unidad ya no cambia. */
  unidad_fija?: boolean;
}

export type RolElemento = 'PAGABLE' | 'PENALIZABLE' | 'INFORMATIVO';

export interface LineaElemento {
  id?: number;
  elemento_id: number;
  rol: RolElemento;
  split_limit: number | null;
  elemento?: Pick<Elemento, 'id' | 'codigo' | 'nombre' | 'unidad_ley'>;
}

export interface LineaProducto {
  id: number;
  codigo: string;
  nombre: string;
  forma: string;
  modalidad_precio: string;
  activa: boolean;
  elementos: LineaElemento[];
  series_count?: number;
}

export interface SerieLote {
  id: number;
  prefijo: string;
  nombre: string;
  linea_producto_id: number;
  linea?: { id: number; codigo: string; nombre: string };
  origen: 'COMPRA' | 'PROPIA';
  formato: string;
  reinicio: 'NUNCA' | 'ANUAL' | 'MENSUAL' | 'DIARIO';
  activa: boolean;
  lotes: number;
  ultimo_numero: number;
  proximo_codigo: string | null;
}

export interface VistaPrevia {
  codigo: string | null;
  repetido: boolean;
  error: string | null;
}

export interface EstadoModulo {
  esquemas: { esquema: string; tablas: number; vistas: number }[];
  catalogo: Record<string, number>;
  series: { prefijo: string; formato: string; reinicio: string; proximo_codigo: string }[];
}

// ---------------------------------------------------------------- Importación

export interface ErrorFila {
  fila: number;
  columna: string;
  mensaje: string;
}

export interface RevisionProductores {
  nuevos: number;
  actualizados: number;
  errores: ErrorFila[];
  advertencias: { fila: number; mensaje: string }[];
  cooperativas_nuevas: string[];
  cooperativas_unificadas: { nombre: string; variantes: string[] }[];
  muestra: {
    fila: number;
    nombre: string;
    documento: string;
    tipo: string;
    cooperativa: string | null;
    accion: 'nuevo' | 'actualiza';
  }[];
  message?: string;
}

export interface ResultadoProductores {
  creados: number;
  actualizados: number;
  cooperativas_creadas: number;
  mensaje: string;
}

// ------------------------------------------------------------ Recepción (sprint 4)

export type EstadoLote = 'RECIBIDO' | 'MUESTREADO' | 'ANALIZADO' | 'LIQUIDADO' | 'ANULADO';
export type EstadoBono = 'PENDIENTE' | 'PAGADO' | 'ANULADO';

export interface Usuario { id: number; name: string; }

export interface Bono {
  id: number;
  pesaje_id: number;
  tramo_id: number;
  beneficiario_nombre: string;
  beneficiario_ci: string | null;
  monto: string;
  moneda: 'BOB' | 'USD';
  estado: EstadoBono;
  movimiento_caja_id: number | null;
  movimiento?: { id: number; numero: string; caja_id: number; fecha: string } | null;
  motivo_anulacion: string | null;
}

export interface Pesaje {
  id: number;
  lote_id: number;
  tipo: 'INGRESO' | 'CONTROL';
  bascula: string;
  ticket: string | null;
  fecha: string;
  /** BASCULA (ticket) o SACOS (balanza manual). */
  modalidad?: ModalidadPesaje;
  /** Mixta: kg de sacos que van en el otro lote y se restan del neto del ticket. */
  descuento_sacos_kg?: string;
  pesaje_viaje_id?: number | null;
  numero_orden?: string | null;
  fecha_ticket?: string | null;
  /** Peso que vale para el lote y con qué regla salió. */
  peso_final_kg?: string;
  criterio_peso?: CriterioPeso;
  viaje?: { id: number; lote_id: number; ticket: string | null; bascula: string; lote?: { id: number; codigo: string } } | null;
  fotos?: FotoRecepcion[];
  sacos?: PesadaSaco[];
  peso_bruto_kg: string;
  tara_kg: string;
  peso_neto_kg: string;
  peso_cliente_kg: string | null;
  peso_cliente_tipo: 'NETO' | 'BRUTO';
  correcciones_cliente?: { id: number; anterior_kg: string | null; anterior_tipo: string; nuevo_kg: string | null; nuevo_tipo: string;
                           motivo: string; corregido_en: string; corregido_por?: Usuario }[];
  num_sacos: number | null;
  placa: string | null;
  chofer_nombre: string | null;
  chofer_ci: string | null;
  anulado: boolean;
  motivo_anulacion: string | null;
  registrado_por: Usuario | number;
  bono?: Bono | null;
}

export interface ResumenLote {
  num_pesajes: number;
  num_sacos: number | null;
  peso_neto_humedo_kg: string;
  /** Peso que declara el cliente; donde no declaró cuenta el de la empresa. */
  peso_cliente_kg: string;
  diferencia_cliente_kg: string;
  pesajes_con_peso_cliente: number;
  humedad_pct?: string | null;
  peso_neto_seco_kg?: string | null;
  ley_zn?: string | null;
  ley_pb?: string | null;
  ley_ag?: string | null;
  bonos_pendientes: number;
  bonos_por_pagar: string;
  bonos_pagados: string;
}

export interface Lote extends ResumenLote {
  id: number;
  codigo: string;
  serie_id: number;
  serie?: { id: number; prefijo: string; nombre: string };
  linea?: { id: number; codigo: string; nombre: string; forma?: string };
  origen: 'COMPRA' | 'PROPIA';
  almacen_id: number;
  almacen?: { id: number; nombre: string };
  fecha_recepcion: string;
  productor_id: number | null;
  productor?: { id: number; nombre: string; ci: string | null; nit: string | null; nim?: string | null; tipo?: string } | null;
  cooperativa?: { id: number; nombre: string } | null;
  mina?: { id: number; nombre: string; propia?: boolean } | null;
  bocamina?: { id: number; codigo: string; nombre: string | null } | null;
  municipio?: { id: number; nombre: string } | null;
  guia_transporte: string | null;
  material: string | null;
  estado: EstadoLote;
  observaciones: string | null;
  registrado_por: Usuario | number;
  anulado_por: Usuario | number | null;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  pesajes?: Pesaje[];
  tipo_recepcion?: TipoRecepcion;
  lote_par_id?: number | null;
  lote_par?: { id: number; codigo: string; material: string | null; estado: EstadoLote } | null;
  /** URL pública del QR del rótulo (solo en la ficha). */
  url_verificacion?: string;
  eventos?: { id: number; estado_anterior: string | null; estado_nuevo: string; ocurrido_en: string; detalle: string | null; usuario?: Usuario }[];
}

export interface DatosPesaje {
  tipo?: 'INGRESO' | 'CONTROL';
  bascula: string;
  ticket: string;
  peso_bruto_kg: number | null;
  tara_kg: number | null;
  peso_cliente_kg?: number | null;
  peso_cliente_tipo?: 'NETO' | 'BRUTO';
  num_sacos: number | null;
  placa: string | null;
  chofer_nombre: string | null;
  chofer_ci: string | null;
  foto_interior_id?: number | null;
  foto_exterior_id?: number | null;
  numero_orden?: string | null;
  fecha_ticket?: string | null;
}

export interface DatosPesadaSaco { sacos: number; peso_kg: number; foto_id: number; }

export interface DatosSacos {
  bascula: string;
  pesadas: DatosPesadaSaco[];
  placa?: string | null;
  chofer_nombre?: string | null;
  chofer_ci?: string | null;
}

export interface DatosRecepcion {
  serie_id: number;
  almacen_id: number;
  productor_id: number | null;
  mina_id: number | null;
  bocamina_id: number | null;
  guia_transporte: string | null;
  material: string | null;
  observaciones: string | null;
  tipo_recepcion?: TipoRecepcion;
  pesaje: DatosPesaje | null;
  sacos?: DatosSacos | null;
  lote_sacos?: { material: string | null; observaciones: string | null } | null;
}

// ------------------------------------------------------- Recepción con fotos
export type TipoRecepcion = 'BASCULA' | 'SACOS' | 'MIXTA';
export type CriterioPeso = 'EMPRESA' | 'CLIENTE' | 'PROMEDIO';

export interface SedeRecepcion { id: number; codigo: string; nombre: string; recepcionistas: { id: number; name: string }[]; }
export type ModalidadPesaje = 'BASCULA' | 'SACOS';
export type TipoFoto = 'TICKET_INTERIOR' | 'TICKET_EXTERIOR' | 'BALANZA_MANUAL';
export type CampoTicket = 'ticket' | 'peso_bruto_kg' | 'tara_kg' | 'peso_neto_kg' | 'placa' | 'numero_orden' | 'productor' | 'chofer' | 'fecha' | 'hora';

/** Recuadro de un dato en el ticket enderezado, en fracciones (0–1). */
export interface RecuadroPlantilla {
  campo: CampoTicket;
  x: number; y: number; w: number; h: number;
  etiqueta?: string | null;
  decimales?: number | null;
  desenfoque?: number | null;
  letras?: boolean | null;
}

export interface PlantillaBascula {
  id: number;
  nombre: string;
  bascula: string;
  uso: 'INTERIOR' | 'EXTERIOR' | 'AMBAS';
  proporcion: number;
  campos: RecuadroPlantilla[];
  activa: boolean;
  tiene_muestra: boolean;
}

export interface CampoDisponible { campo: CampoTicket; etiqueta: string; tipo: 'numero' | 'digitos' | 'texto' | 'nombre' | 'fecha'; }

export interface ProductorParecido { id: number; nombre: string; ci: string | null; parecido: number; cooperativa: { id: number; nombre: string | null } | null; }

export interface LecturaCampo { texto: string; valor: number | string | null; confianza: number; metodo: 'recuadro' | 'etiqueta' | 'calculado' | 'corregido'; verificado?: boolean; }

export interface LecturaTicket {
  campos: Partial<Record<CampoTicket, LecturaCampo>>;
  coherente: boolean | null;
  avisos: string[];
  /** Fecha y hora de la boleta (Y-m-d H:i:s), si se pudo leer. */
  fecha_ticket?: string | null;
}

export interface FotoRecepcion {
  id: number;
  tipo: TipoFoto;
  plantilla_id?: number | null;
  lectura?: LecturaTicket | null;
  pesaje_id?: number | null;
  pesaje_saco_id?: number | null;
  created_at?: string;
  /** Báscula de la plantilla con que se leyó (al subir). */
  bascula?: string | null;
}

export interface PesadaSaco { id: number; orden: number; sacos: number; peso_kg: string; fotos?: FotoRecepcion[]; }

export interface Tramo {
  id?: number;
  tipo_vehiculo: string;
  peso_desde_kg: string | number;
  peso_hasta_kg: string | number | null;
  monto: string | number;
  moneda?: string;
}

export interface TablaTramos {
  vigente_desde: string;
  vigente_hasta: string | null;
  estado: 'VIGENTE' | 'PROXIMA' | 'ANTERIOR';
  tramos: Tramo[];
}

export interface BonoCalculado { tramo_id: number; tipo_vehiculo: string; monto: string; moneda: string; }

export interface BonoPendiente extends Bono {
  pesaje: { id: number; lote_id: number; ticket: string; placa: string | null; peso_neto_kg: string; fecha: string;
            lote: { id: number; codigo: string; productor?: { id: number; nombre: string } | null } };
}

// ---------------------------------------------------------- Laboratorio (sprint 5)

export type TipoAnalisis = 'EMPRESA' | 'PRODUCTOR' | 'DIRIMENTE';
export type CriterioLey = 'PROMEDIO' | 'EMPRESA' | 'DIRIMENTE' | 'ACUERDO';

export interface ElementoLote {
  id: number; codigo: string; nombre: string; unidad_ley: string;
  rol: 'PAGABLE' | 'PENALIZABLE' | 'INFORMATIVO' | 'HUMEDAD';
  split_limit: string | null;
  requerido: boolean;
}

export interface Porcion { id: number; destino: 'EMPRESA' | 'PRODUCTOR' | 'TESTIGO'; precinto: string | null; entregada_a: string | null; }

export interface Analisis {
  id: number; muestra_id: number; tipo: TipoAnalisis;
  laboratorio_id: number; laboratorio?: { id: number; nombre: string };
  numero_certificado: string | null; fecha_emision: string | null;
  anulado: boolean; motivo_anulacion: string | null; con_certificado: boolean;
  registrado_por: Usuario | number; created_at: string;
  resultados: { id: number; elemento_id: number; valor: string; elemento?: { id: number; codigo: string; unidad_ley: string } }[];
}

export interface Muestra {
  id: number; lote_id: number; codigo: string; tipo: 'PRINCIPAL' | 'REMUESTREO'; fecha: string;
  metodo: string | null; peso_g: string | null; observaciones: string | null;
  registrado_por: Usuario | number; porciones: Porcion[]; analisis: Analisis[];
}

export interface Ensaye {
  elemento_id: number; elemento: string; unidad_ley: string; muestra: string;
  ley_empresa: string | null; ley_productor: string | null; ley_dirimente: string | null;
  diferencia: string | null; split_limit: string | null; excede_split_limit: boolean; promedio: string | null;
}

export interface LeyFinal {
  id: number; elemento_id: number; valor: string; criterio: CriterioLey; observacion: string | null;
  determinado_en: string; determinado_por: Usuario | number;
  elemento?: { id: number; codigo: string; nombre: string; unidad_ley: string };
}

export interface HistorialLey {
  id: number; elemento: string; valor: string; criterio: CriterioLey; accion: 'CAMBIADA' | 'QUITADA';
  cambiado_en: string; cambiado_por_nombre: string | null; observacion: string | null;
}

export interface LaboratorioLote {
  estado: EstadoLote;
  elementos: ElementoLote[];
  muestras: Muestra[];
  ensayes: Ensaye[];
  leyes: LeyFinal[];
  historial: HistorialLey[];
  lecturas: { id: number; elemento_id: number; valor: string; metodo: string | null; elemento?: { codigo: string; unidad_ley: string } }[];
  laboratorios: { id: number; nombre: string; propio: boolean }[];
  criterio_sugerido: 'PROMEDIO' | 'EMPRESA';
  humedad_pct: string | null;
  peso_neto_seco_kg: string | null;
}

export interface FilaBandeja {
  lote_id: number; codigo: string; estado: EstadoLote; fecha_recepcion: string; muestra: string | null;
  con_empresa: boolean; con_productor: boolean; con_dirimente: boolean; requiere_dirimencia: boolean;
  leyes_requeridas: number; leyes_fijadas: number; productor: string | null; linea: string | null; material: string | null;
}

export interface DatosMuestra {
  metodo: string | null; peso_g: number | null; observaciones: string | null;
  porciones: { destino: Porcion['destino']; precinto: string; entregada_a?: string | null }[];
}

// ------------------------------------------------------------ Precios (sprint 6)

export type SituacionTabla = 'BORRADOR' | 'APROBADA' | 'ANULADA' | 'VIGENTE' | 'PROXIMA' | 'ANTERIOR';

export interface TramoPrecio {
  id?: number; ley_desde: string | number | null; ley_hasta: string | number | null;
  precio_punto: string | number | null; porcentaje_pagable: string | number | null;
}

export interface TablaPrecio {
  id: number; linea_producto_id: number; elemento_id: number;
  modalidad: 'POR_PUNTO' | 'POR_PORCENTAJE'; moneda: 'BOB' | 'USD'; factor_conversion: string | null;
  descripcion: string | null; vigente_desde: string; vigente_hasta: string | null;
  estado: 'BORRADOR' | 'APROBADA' | 'ANULADA'; situacion: SituacionTabla;
  creado_por: Usuario | number; aprobado_por: Usuario | number | null; aprobado_en: string | null;
  linea?: { id: number; codigo: string; nombre: string; modalidad_precio?: string };
  elemento?: { id: number; codigo: string; nombre: string; unidad_ley: string; unidad_cotizacion?: string | null };
  tramos?: TramoPrecio[]; tramos_count?: number;
  vista_previa?: { cotizacion: { valor: string; tipo: string; unidad: string; periodo: string } | null;
                   tramos: { id: number; valor_desde: number | null; valor_hasta: number | null; hueco: boolean; baja: boolean }[] };
}

export interface Cotizacion {
  id: number; elemento_id: number; elemento?: { id: number; codigo: string; nombre: string };
  tipo: 'OFICIAL' | 'REFERENCIA'; anio: number; mes: number; quincena: 1 | 2;
  periodo_desde: string; periodo_hasta: string; valor: string; unidad: string;
  alicuota_rm_exportacion: string | null; alicuota_rm_venta_interna: string | null;
  fuente: string | null; fecha_publicacion: string | null;
}

export interface TasaRetencion {
  id: number; concepto_id: number; cooperativa_id: number | null; cooperativa?: { id: number; nombre: string } | null;
  porcentaje: string; vigente_desde: string; vigente_hasta: string | null; vigente: boolean; proxima: boolean;
}

export interface ConceptoRetencion {
  id: number; codigo: string; nombre: string; base_calculo: string; por_cooperativa: boolean; norma: string | null;
  tasas: TasaRetencion[];
}

export interface ValorElemento {
  elemento_id: number; elemento: string; unidad_ley: string;
  fuente: 'LEY_FINAL' | 'ANALISIS_EMPRESA' | 'LECTURA_ESTIMADA' | null; ley: string | null;
  tabla_precio_id: number | null; modalidad: string | null; moneda: string | null;
  cotizacion: string | null; cotizacion_tipo: string | null;
  valor_por_tm: string | null; peso_seco_tm: string | null; valor: string | null; observacion: string | null;
}

export interface ValorLote {
  elementos: ValorElemento[]; totales: Record<string, number>; completo: boolean; definitivo: boolean; fecha: string;
}
