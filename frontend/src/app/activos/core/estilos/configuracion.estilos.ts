/**
 * Estilos compartidos por las pantallas de configuración del módulo.
 *
 * Van acá y no en cada componente para que las cuatro pantallas se vean como
 * una sola cosa: si mañana cambia el alto de las filas o el color de los
 * encabezados, se cambia en un lugar.
 *
 * No dependen de PrimeFlex ni de Tailwind: usan variables de PrimeNG con
 * respaldo fijo, así respetan el tema y funcionan aunque falten.
 */
export const ESTILOS_CONFIG = `
  :host {
    display: block;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  /* ------------------------------------------------------------ Encabezado */

  .encabezado {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .encabezado h2 {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 650;
    letter-spacing: -0.02em;
  }

  .subtitulo {
    margin: 0.35rem 0 0;
    max-width: 62ch;
    font-size: 0.85rem;
    line-height: 1.45;
    color: var(--text-color-secondary, #6b7280);
  }

  .acciones { display: flex; gap: 0.5rem; flex-shrink: 0; }

  /* --------------------------------------------------------- Barra de filtro */

  .barra {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    padding: 0.9rem 1rem;
    margin-bottom: 1.25rem;
    background: var(--surface-card, #fff);
    border: 1px solid var(--surface-border, #e5e7eb);
    border-radius: 10px;
  }

  .campo-busqueda { position: relative; flex: 1 1 18rem; }

  .campo-busqueda i {
    position: absolute;
    left: 0.85rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.9rem;
    color: var(--text-color-secondary, #9ca3af);
    pointer-events: none;
  }

  .campo-busqueda input { width: 100%; padding-left: 2.4rem; }

  .barra .filtro { flex: 0 1 14rem; }
  .barra .filtro .p-dropdown { width: 100%; }

  /* ----------------------------------------------------------------- Tabla */

  .tabla { font-size: 0.9rem; }

  :host ::ng-deep .tabla .p-datatable-thead > tr > th {
    background: var(--surface-ground, #f9fafb);
    font-size: 0.72rem;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-color-secondary, #6b7280);
    border-bottom: 1px solid var(--surface-border, #e5e7eb);
    padding: 0.75rem 1rem;
  }

  :host ::ng-deep .tabla .p-datatable-tbody > tr > td {
    padding: 0.7rem 1rem;
    border-bottom: 1px solid var(--surface-border, #f1f3f5);
  }

  :host ::ng-deep .tabla .p-datatable-tbody > tr:hover {
    background: var(--surface-hover, #f9fafb);
  }

  .derecha { text-align: right; }
  .centro  { text-align: center; }

  .inactiva { opacity: 0.55; }

  .codigo {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .secundario {
    font-size: 0.78rem;
    color: var(--text-color-secondary, #9ca3af);
    margin-top: 0.1rem;
  }

  .numero { font-variant-numeric: tabular-nums; }

  .guion { color: var(--surface-border, #d1d5db); }

  /* ------------------------------------------------------------- Sin datos */

  .vacio {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 3.5rem 1rem;
  }

  .vacio i { font-size: 2.5rem; color: var(--surface-border, #d1d5db); }

  .titulo-vacio {
    margin: 0;
    font-size: 0.95rem;
    color: var(--text-color-secondary, #6b7280);
  }

  /* ------------------------------------------------------ Campos de diálogo */

  .campos {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 1rem;
    padding-top: 0.5rem;
  }

  .campo { display: flex; flex-direction: column; gap: 0.35rem; }

  .span-1 { grid-column: span 1; }
  .span-2 { grid-column: span 2; }
  .span-3 { grid-column: span 3; }
  .span-4 { grid-column: span 4; }
  .span-6 { grid-column: span 6; }

  @media (max-width: 640px) {
    .campos { grid-template-columns: repeat(2, 1fr); }
    .span-1, .span-2, .span-3, .span-4 { grid-column: span 1; }
    .span-6 { grid-column: span 2; }
  }

  .campo label { font-size: 0.8rem; font-weight: 550; }

  .campo small {
    font-size: 0.73rem;
    color: var(--text-color-secondary, #9ca3af);
  }

  .campo :is(input, textarea, .p-dropdown, .p-calendar, .p-inputnumber) { width: 100%; }

  /* ------------------------------------------------------------------ Notas */

  .nota {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    padding: 0.75rem 0.9rem;
    font-size: 0.82rem;
    line-height: 1.45;
    color: #1e40af;
    background: #eff6ff;
    border-left: 3px solid #3b82f6;
    border-radius: 6px;
  }

  .nota i { margin-top: 0.1rem; }

  .nota-aviso {
    color: #92400e;
    background: #fffbeb;
    border-left-color: #f59e0b;
  }

  .nota-neutra {
    color: var(--text-color-secondary, #4b5563);
    background: var(--surface-ground, #f9fafb);
    border-left-color: var(--surface-border, #d1d5db);
  }

  .nota-encabezado { margin-bottom: 1.25rem; }
`;
