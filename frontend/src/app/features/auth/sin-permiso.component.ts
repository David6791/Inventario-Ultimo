import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-sin-permiso',
  standalone: true,
  imports: [RouterLink, ButtonModule],
  template: `
    <main class="pantalla">
      <i class="pi pi-lock"></i>
      <h1>No tiene acceso a esta sección</h1>
      <p>Su rol actual no incluye este permiso. Si necesita entrar, pida al
         administrador que lo agregue a su rol.</p>
      <div class="acciones">
        <button pButton label="Volver" severity="secondary" text (click)="atras()"></button>
        <button pButton label="Ir al tablero" routerLink="/tablero"></button>
      </div>
    </main>
  `,
  styles: [`
    .pantalla { min-height:70dvh; display:flex; flex-direction:column; align-items:center;
                justify-content:center; text-align:center; gap:.75rem; padding:1.5rem; }
    i { font-size:2.5rem; color:var(--text-color-secondary); }
    h1 { margin:0; font-size:1.25rem; font-weight:600; }
    p  { margin:0; max-width:44ch; color:var(--text-color-secondary); line-height:1.55; }
    .acciones { display:flex; gap:.5rem; margin-top:.75rem; }
  `],
})
export class SinPermisoComponent {
  private readonly location = inject(Location);
  atras(): void { this.location.back(); }
}
