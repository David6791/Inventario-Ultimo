import { Component, input } from '@angular/core';

/**
 * Lista los problemas del formulario arriba de todo.
 *
 * Existe porque un mensaje bajo un campo que quedó fuera de la pantalla no
 * comunica nada: el usuario aprieta Guardar, no pasa nada visible, y concluye
 * que el sistema está roto.
 */
@Component({
  selector: 'app-resumen-errores',
  standalone: true,
  template: `
    @if (problemas().length) {
      <div class="caja" role="alert">
        <div class="titulo">
          <i class="pi pi-exclamation-circle"></i>
          <span>Revise {{ problemas().length === 1 ? 'este punto' : 'estos puntos' }} antes de guardar</span>
        </div>
        <ul>
          @for (problema of problemas(); track problema) {
            <li>{{ problema }}</li>
          }
        </ul>
      </div>
    }
  `,
  styles: [`
    .caja { border:1px solid var(--red-200); background:var(--alerta-lavado);
            border-radius:var(--radio); padding:.75rem 1rem; margin-bottom:1rem; }
    .titulo { display:flex; align-items:center; gap:.5rem; font-weight:600;
              color:var(--red-700); font-size:var(--t-sm); margin-bottom:.25rem; }
    ul { margin:0; padding-left:1.75rem; color:var(--red-700);
         font-size:var(--t-sm); line-height:1.6; }
  `],
})
export class ResumenErroresComponent {
  readonly problemas = input.required<string[]>();
}
