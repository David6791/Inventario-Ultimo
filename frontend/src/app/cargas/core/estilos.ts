import { ESTILOS_CONFIG } from '../../activos/core/estilos/configuracion.estilos';

/**
 * Las pantallas de cargas usan los mismos estilos de configuración que las de
 * activos (encabezado, barra de filtro, tabla, diálogo), más unas piezas
 * propias del módulo.
 */
export const ESTILOS_CARGAS = ESTILOS_CONFIG + `
  .pastilla {
    display: inline-block;
    padding: 0.08rem 0.45rem;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    border-radius: 4px;
    background: var(--surface-ground, #f3f4f6);
    color: var(--text-color-secondary, #4b5563);
  }

  .pastilla-acento { background: #e0f2fe; color: #075985; }
  .pastilla-aviso  { background: #fef3c7; color: #92400e; }

  .contador {
    font-variant-numeric: tabular-nums;
    color: var(--text-color-secondary, #6b7280);
  }

  /* Casilla y su texto en la misma línea (.campo apila en columna). */
  .campo.check-campo {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
  }

  .campo.check-campo label { font-weight: 400; }

  /* Los botones de la última columna van en una sola línea. */
  :host ::ng-deep .tabla .p-datatable-tbody > tr > td:last-child { white-space: nowrap; }
`;
