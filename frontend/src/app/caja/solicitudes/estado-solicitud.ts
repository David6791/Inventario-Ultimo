import { EstadoSolicitud, SolicitudConUsuarios, UsuarioCorto } from '../core/caja.model';

/** Piezas comunes de las pantallas de solicitudes: estado, detalle y colores. */

export function etiquetaEstado(estado: EstadoSolicitud): string {
  return ({
    PENDIENTE: 'Pendiente de aprobación',
    APROBADA: 'Aprobada · por pagar',
    RECHAZADA: 'Rechazada',
    PAGADA: 'Pagada',
    ANULADA: 'Anulada',
  } as Record<EstadoSolicitud, string>)[estado] ?? estado;
}

export function nombreUsuario(u: UsuarioCorto | number | null | undefined): string {
  return u && typeof u === 'object' ? u.name : '';
}

/** Una línea con quién la resolvió, por qué o con qué comprobante se pagó. */
export function detalleEstado(s: SolicitudConUsuarios): string {
  switch (s.estado) {
    case 'APROBADA':
      return `Aprobó ${nombreUsuario(s.resuelto_por)}${s.observacion ? ': ' + s.observacion : ''}`;
    case 'RECHAZADA':
      return `${nombreUsuario(s.resuelto_por)}: ${s.observacion ?? ''}`;
    case 'PAGADA':
      return `Comprobante ${s.movimiento?.numero ?? ''} · aprobó ${nombreUsuario(s.resuelto_por)}`;
    case 'ANULADA':
      return `${nombreUsuario(s.anulado_por)}: ${s.motivo_anulacion ?? ''}`;
    default:
      return '';
  }
}

export const ESTILOS_SOLICITUD = `
  .estado-PENDIENTE { background: #fef3c7; color: #92400e; }
  .estado-APROBADA  { background: #dbeafe; color: #1e40af; }
  .estado-RECHAZADA { background: #fee2e2; color: #991b1b; }
  .estado-PAGADA    { background: #dcfce7; color: #166534; }
  .estado-ANULADA   { background: var(--surface-ground, #f3f4f6); color: var(--text-color-secondary, #6b7280); }
  .detalle-estado { font-size: 0.75rem; margin-top: 0.2rem; max-width: 16rem; }
`;
