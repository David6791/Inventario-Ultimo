/** Estilos del laboratorio en la ficha del lote (aparte, por el límite de tamaño por hoja de estilos). */
export const ESTILOS_LABORATORIO = `
  .laboratorio { margin-top: 1.2rem; }
  .cabeza { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
  .titulo-seccion { font-size: 0.95rem; margin: 0 0 0.5rem; }
  .acciones-lab { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .tarjeta-lab { border: 1px solid var(--surface-border, #e5e7eb); border-radius: 8px; padding: 0.8rem 1rem;
                 background: var(--surface-card, #fff); margin-bottom: 0.8rem; }
  .titulo-tarjeta { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; font-weight: 600; margin-bottom: 0.5rem; }
  .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
  .monto { font-family: ui-monospace, 'SF Mono', Menlo, monospace; white-space: nowrap; }
  .fuerte { font-weight: 700; }
  .rotulo { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-color-secondary, #6b7280); }
  .resultado { display: flex; gap: 1.6rem; flex-wrap: wrap; padding: 0.7rem 1rem; margin-bottom: 0.8rem; border-radius: 8px;
               background: #f0fdf4; border: 1px solid #bbf7d0; }
  .resultado > div { display: flex; flex-direction: column; }
  .resultado .monto { font-size: 1.1rem; font-weight: 700; }
  .estimada, .resultados { display: flex; gap: 0.7rem; flex-wrap: wrap; align-items: flex-end; }
  .campo-mini { display: flex; flex-direction: column; gap: 0.25rem; width: 7.5rem; font-size: 0.8rem; }
  .campo-mini.ancho { width: 12rem; }
  :host ::ng-deep .campo-mini .p-inputnumber, :host ::ng-deep .campo-mini input { width: 100%; }
  .porciones { display: flex; gap: 1.2rem; flex-wrap: wrap; font-size: 0.85rem; margin-bottom: 0.7rem; }
  .analisis-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.7rem; }
  .slot { border: 1px dashed var(--surface-border, #d1d5db); border-radius: 8px; padding: 0.6rem 0.8rem; font-size: 0.85rem; }
  .slot-titulo { font-weight: 650; margin-bottom: 0.25rem; }
  .valores { display: flex; gap: 0.8rem; flex-wrap: wrap; margin: 0.35rem 0; font-family: ui-monospace, Menlo, monospace; }
  .slot-acciones { display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap; }
  .adjuntar { cursor: pointer; color: var(--primary-color, #2563eb); font-size: 0.8rem; }
  table.leyes { width: 100%; border-collapse: collapse; font-size: 0.88rem; margin-bottom: 0.8rem; }
  table.leyes th { text-align: left; font-size: 0.7rem; text-transform: uppercase; color: var(--text-color-secondary, #6b7280);
                   padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--surface-border, #e5e7eb); }
  table.leyes td { padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--surface-border, #f1f5f9); vertical-align: top; }
  table.leyes .derecha, table.leyes th.derecha { text-align: right; }
  tr.excede td { background: #fef2f2; }
  .rojo { color: #b91c1c; font-weight: 700; }
  .verde { color: #15803d; font-weight: 600; }
  .anteriores { font-size: 0.85rem; margin-top: 0.4rem; }
  .linea-hist { padding: 0.2rem 0; }
  .formulario { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem 1rem; margin-bottom: 0.8rem; }
  .formulario .campo { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; }
  .formulario .ancho { grid-column: span 2; }
  :host ::ng-deep .formulario .p-dropdown, :host ::ng-deep .formulario .p-inputnumber, .formulario input, .formulario textarea { width: 100%; }
  .criterios { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.8rem; }
  .criterio { display: flex; align-items: center; gap: 0.6rem; }
  .criterio .monto { margin-left: auto; }
  .criterio.deshabilitado { color: var(--text-color-secondary, #9ca3af); }
  .explicacion { font-size: 0.88rem; line-height: 1.5; margin-top: 0; }
  .ancho-total { width: 100%; }
`;
