import { ESTILOS_CARGAS } from '../../cargas/core/estilos';

/**
 * Caja usa las mismas piezas que las pantallas de configuración de activos y
 * cargas (encabezado, barra, tabla, diálogo, pastillas), más las propias.
 *
 * Es una lista, no un solo texto: Angular mide cada hoja por separado contra
 * el presupuesto de 4 kB por estilo de componente, y juntas lo pasaban.
 * Uso: styles: [...ESTILOS_CAJA, `estilos propios`]
 */
export const ESTILOS_CAJA = [ESTILOS_CARGAS, `
  .monto { font-variant-numeric: tabular-nums; font-family: ui-monospace, 'SF Mono', Menlo, monospace; white-space: nowrap; }
  .ingreso { color: #15803d; }
  .egreso  { color: #b91c1c; }
  .pastilla-ingreso { background: #dcfce7; color: #166534; }
  .pastilla-egreso  { background: #fee2e2; color: #991b1b; }
  .pastilla-ok      { background: #dcfce7; color: #166534; }
`];
