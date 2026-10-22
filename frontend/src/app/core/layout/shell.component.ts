import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { MenuModule } from 'primeng/menu';
import { PanelMenuModule } from 'primeng/panelmenu';
import { SidebarModule } from 'primeng/sidebar';
import { filter } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { EmpresaService } from '../services/empresa.service';
import { PermisosService } from '../services/permisos.service';
import { construirMenu } from './menu';

/**
 * Marco de la aplicación. En pantallas anchas el menú queda fijo a la
 * izquierda; en el celular se abre con el botón ☰ como panel lateral y se
 * cierra solo al elegir una opción.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, NgTemplateOutlet, FormsModule, PanelMenuModule, MenuModule,
    ButtonModule, DropdownModule, SidebarModule,
  ],
  template: `
    <div class="marco">
      <aside class="lateral">
        <ng-container *ngTemplateOutlet="navegacion" />
      </aside>

      <div class="columna">
        <header>
          <button pButton type="button" icon="pi pi-bars" text rounded class="hamburguesa"
                  aria-label="Abrir el menú" (click)="menuMovil = true"></button>

          <a routerLink="/tablero" class="marca-corta">
            @if (empresa.logoUrl(); as logo) { <img [src]="logo" alt="" /> }
            <span>{{ empresa.nombre() || 'Inicio' }}</span>
          </a>

          <div class="almacen">
            @if (almacenes().length > 1) {
              <p-dropdown [options]="almacenes()" [ngModel]="almacenActivoId()"
                          (ngModelChange)="cambiarAlmacen($event)"
                          optionLabel="nombre" optionValue="id" styleClass="selector-almacen" />
            } @else if (almacenes().length === 1) {
              <span class="almacen-fijo">
                <i class="pi pi-building"></i> {{ almacenes()[0].nombre }}
              </span>
            }
          </div>

          <button type="button" class="usuario" (click)="menuUsuario.toggle($event)" aria-label="Opciones de usuario">
            <span class="avatar">{{ iniciales() }}</span>
            <span class="nombre-usuario">{{ permisos.usuario()?.name }}</span>
            <i class="pi pi-angle-down"></i>
          </button>
          <p-menu #menuUsuario [model]="opcionesUsuario" [popup]="true" appendTo="body" />
        </header>

        <main><router-outlet /></main>
      </div>
    </div>

    <!-- Fuera de la grilla: si quedara dentro, ocuparía la columna del contenido. -->
    <p-sidebar [(visible)]="menuMovil" [blockScroll]="true" styleClass="menu-movil" [showCloseIcon]="true">
      <ng-container *ngTemplateOutlet="navegacion" />
    </p-sidebar>

    <ng-template #navegacion>
      <a routerLink="/tablero" class="marca">
        @if (empresa.logoUrl(); as logo) {
          <img [src]="logo" alt="Logo" />
        } @else {
          <span class="marca-icono"><i class="pi pi-box"></i></span>
        }
        <span class="marca-texto">
          <strong>{{ empresa.nombre() || 'Sistema' }}</strong>
          <small>Sistema de gestión</small>
        </span>
      </a>
      <p-panelMenu [model]="menu()" [multiple]="false" styleClass="navegacion" />
    </ng-template>
  `,
  styles: [`
    .marco { display:grid; grid-template-columns:16.5rem 1fr; min-height:100dvh; }

    .lateral { position:sticky; top:0; height:100dvh; overflow-y:auto;
               border-right:1px solid var(--surface-border); background:var(--surface-card);
               padding:1rem .75rem 2rem; }
    .marca { display:flex; align-items:center; gap:.65rem; padding:.25rem .5rem 1.1rem;
             margin-bottom:.5rem; border-bottom:1px solid var(--linea-tenue, #edf1f2);
             text-decoration:none; color:inherit; }
    .marca img { max-height:2.6rem; max-width:5.5rem; object-fit:contain; flex:none; }
    .marca-icono { width:2.4rem; height:2.4rem; border-radius:10px; flex:none; display:grid; place-items:center;
                   background:var(--acento-lavado, #e6f2f3); color:var(--acento, #0e7c86); font-size:1.1rem; }
    .marca-texto { display:flex; flex-direction:column; min-width:0; line-height:1.25; }
    .marca-texto strong { font-size:.9rem; font-weight:600; overflow:hidden; text-overflow:ellipsis; }
    .marca-texto small { font-size:.72rem; color:var(--text-color-secondary); }

    :host ::ng-deep .navegacion .p-panelmenu-panel { border:0; margin-bottom:.1rem; }
    :host ::ng-deep .navegacion .p-panelmenu-header-content { border:0; background:transparent; border-radius:8px; }
    :host ::ng-deep .navegacion .p-panelmenu-header-action { padding:.6rem .75rem; font-weight:500; font-size:.88rem; }
    :host ::ng-deep .navegacion .p-panelmenu-header:not(.p-disabled):hover .p-panelmenu-header-content { background:var(--acento-lavado, #e6f2f3); }
    :host ::ng-deep .navegacion .p-panelmenu-content { border:0; background:transparent; padding:.15rem 0 .35rem .6rem; }
    :host ::ng-deep .navegacion .p-menuitem-link { padding:.5rem .75rem !important; border-radius:8px; font-size:.85rem; }
    :host ::ng-deep .navegacion .p-menuitem-link:hover { background:var(--acento-lavado, #e6f2f3) !important; }
    :host ::ng-deep .navegacion .p-menuitem-link-active { background:var(--acento-lavado, #e6f2f3) !important;
                                                          box-shadow:inset 3px 0 0 var(--acento, #0e7c86); }
    :host ::ng-deep .navegacion .p-menuitem-link-active .p-menuitem-text,
    :host ::ng-deep .navegacion .p-menuitem-link-active .p-menuitem-icon { color:var(--acento, #0e7c86) !important; font-weight:600; }

    .columna { min-width:0; display:flex; flex-direction:column; }
    header { position:sticky; top:0; z-index:20; display:flex; align-items:center; gap:.75rem;
             padding:.55rem 1.5rem; min-height:3.5rem;
             border-bottom:1px solid var(--surface-border); background:rgba(255,255,255,.94);
             backdrop-filter:blur(6px); }
    .hamburguesa, .marca-corta { display:none; }
    .almacen { flex:1; min-width:0; }
    .almacen-fijo { font-size:.875rem; color:var(--text-color-secondary); white-space:nowrap; }
    .usuario { display:flex; align-items:center; gap:.5rem; border:0; background:transparent; cursor:pointer;
               padding:.3rem .5rem .3rem .3rem; border-radius:999px; font:inherit; font-size:.875rem; color:inherit; }
    .usuario:hover { background:var(--acento-lavado, #e6f2f3); }
    .avatar { width:2rem; height:2rem; border-radius:50%; display:grid; place-items:center; flex:none;
              background:var(--acento, #0e7c86); color:#fff; font-size:.75rem; font-weight:600; letter-spacing:.02em; }
    main { padding:1.5rem; min-width:0; }

    @media (max-width: 60rem) {
      .marco { grid-template-columns:1fr; }
      .lateral { display:none; }
      .hamburguesa { display:inline-flex; margin-left:-.4rem; }
      .marca-corta { display:flex; align-items:center; gap:.45rem; min-width:0; text-decoration:none; color:inherit;
                     font-weight:600; font-size:.9rem; }
      .marca-corta img { height:1.7rem; max-width:3.5rem; object-fit:contain; }
      .marca-corta span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      header { padding:.45rem .75rem; gap:.4rem; }
      .almacen { display:flex; justify-content:flex-end; }
      .almacen-fijo { display:none; }
      .nombre-usuario, .usuario .pi-angle-down { display:none; }
      main { padding:1rem .75rem 2rem; }
    }
  `],
})
export class ShellComponent {
  readonly permisos = inject(PermisosService);
  readonly empresa = inject(EmpresaService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** El menú se recalcula solo cuando cambian los permisos del usuario. */
  readonly menu = construirMenu(this.permisos);

  readonly almacenes = this.permisos.almacenes;
  readonly almacenActivoId = computed(() => this.permisos.almacenActivo()?.id ?? null);

  /** Panel del menú en el celular. */
  menuMovil = false;

  readonly iniciales = computed(() =>
    (this.permisos.usuario()?.name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase());

  readonly opcionesUsuario: MenuItem[] = [
    { label: 'Cambiar contraseña', icon: 'pi pi-key', routerLink: '/cambiar-clave' },
    { separator: true },
    { label: 'Cerrar sesión', icon: 'pi pi-sign-out', command: () => this.auth.logout() },
  ];

  constructor() {
    this.empresa.cargar();
    // Al elegir una opción en el celular, el panel se cierra solo.
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => (this.menuMovil = false));
  }

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
