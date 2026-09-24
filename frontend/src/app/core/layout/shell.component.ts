import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { MenuModule } from 'primeng/menu';
import { PanelMenuModule } from 'primeng/panelmenu';
import { AuthService } from '../services/auth.service';
import { PermisosService } from '../services/permisos.service';
import { construirMenu } from './menu';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet, FormsModule, PanelMenuModule, MenuModule,
    ButtonModule, DropdownModule,
  ],
  template: `
    <div class="marco">
      <aside>
        <div class="marca">Inventarios</div>
        <p-panelMenu [model]="menu()" styleClass="navegacion" />
      </aside>

      <div class="columna">
        <header>
          @if (almacenes().length > 1) {
            <p-dropdown [options]="almacenes()" [ngModel]="almacenActivoId()"
                        (ngModelChange)="cambiarAlmacen($event)"
                        optionLabel="nombre" optionValue="id" styleClass="selector-almacen" />
          } @else if (almacenes().length === 1) {
            <span class="almacen-fijo">
              <i class="pi pi-building"></i> {{ almacenes()[0].nombre }}
            </span>
          }

          <div class="usuario">
            <span>{{ permisos.usuario()?.name }}</span>
            <button pButton icon="pi pi-ellipsis-v" text rounded
                    (click)="menuUsuario.toggle($event)"></button>
            <p-menu #menuUsuario [model]="opcionesUsuario" [popup]="true" />
          </div>
        </header>

        <main><router-outlet /></main>
      </div>
    </div>
  `,
  styles: [`
    .marco { display:grid; grid-template-columns:15rem 1fr; min-height:100dvh; }
    aside { border-right:1px solid var(--surface-border); background:var(--surface-card);
            padding:1rem .75rem; }
    .marca { font-weight:600; font-size:1rem; padding:.5rem .75rem 1.25rem; }
    :host ::ng-deep .navegacion .p-panelmenu-panel { border:0; }

    header { display:flex; justify-content:space-between; align-items:center;
             gap:1rem; padding:.75rem 1.5rem;
             border-bottom:1px solid var(--surface-border);
             background:var(--surface-card); }
    .almacen-fijo { font-size:.875rem; color:var(--text-color-secondary); }
    .usuario { display:flex; align-items:center; gap:.375rem; font-size:.875rem; }
    main { padding:1.5rem; }

    @media (max-width: 60rem) {
      .marco { grid-template-columns:1fr; }
      aside { display:none; }
    }
  `],
})
export class ShellComponent {
  readonly permisos = inject(PermisosService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** El menú se recalcula solo cuando cambian los permisos del usuario. */
  readonly menu = construirMenu(this.permisos);

  readonly almacenes = this.permisos.almacenes;
  readonly almacenActivoId = computed(() => this.permisos.almacenActivo()?.id ?? null);

  readonly opcionesUsuario: MenuItem[] = [
    { label: 'Cambiar contraseña', icon: 'pi pi-key', routerLink: '/cambiar-clave' },
    { separator: true },
    { label: 'Cerrar sesión', icon: 'pi pi-sign-out', command: () => this.auth.logout() },
  ];

  /**
   * Cambia el almacen activo y vuelve a montar la pantalla actual para que
   * recargue sus datos con el nuevo X-Almacen-Id.
   *
   * Nada de window.location.reload(): ademas de perder el estado de la
   * aplicacion, provocaba un bucle. Los componentes de formulario emiten su
   * evento de cambio al inicializarse, asi que la carga de la pantalla
   * disparaba una recarga, que volvia a cargar la pantalla, y asi.
   */
  cambiarAlmacen(id: number | null): void {
    if (id == null || id === this.almacenActivoId()) {
      return;
    }

    this.permisos.cambiarAlmacen(id);

    const destino = this.router.url;
    this.router.navigateByUrl('/', { skipLocationChange: true })
      .then(() => this.router.navigateByUrl(destino));
  }
}
