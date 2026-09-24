import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Rol } from '../../core/models/auth.models';
import { RolService } from '../../core/services/rol.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-rol-lista',
  standalone: true,
  imports: [
    RouterLink, TableModule, ButtonModule, InputTextModule, TagModule,
    TooltipModule, TienePermisoDirective,
  ],
  template: `
    <header class="encabezado">
      <div>
        <h1>Roles y permisos</h1>
        <p>Cada rol define qué puede hacer un usuario. Dónde lo hace se define
           en su ficha, con los almacenes asignados.</p>
      </div>

      <button pButton routerLink="/roles/nuevo"
              icon="pi pi-plus" label="Crear rol"
              *appTienePermiso="'roles.crear'"></button>
    </header>

    <p-table [value]="roles()" [loading]="cargando()" [paginator]="true" [rows]="15"
             [totalRecords]="total()" [lazy]="true" (onLazyLoad)="cargar($event.first ?? 0)"
             dataKey="id" styleClass="p-datatable-sm">

      <ng-template pTemplate="caption">
        <span class="p-input-icon-left">
          <i class="pi pi-search"></i>
          <input pInputText type="search" placeholder="Buscar rol"
                 (input)="buscar($any($event.target).value)" />
        </span>
      </ng-template>

      <ng-template pTemplate="header">
        <tr>
          <th style="width:22%">Rol</th>
          <th>Descripción</th>
          <th style="width:9%" class="centrado">Permisos</th>
          <th style="width:9%" class="centrado">Usuarios</th>
          <th style="width:12%"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-rol>
        <tr>
          <td>
            <span class="nombre-rol">{{ rol.name }}</span>
            @if (rol.es_sistema) {
              <p-tag value="Sistema" severity="secondary" [rounded]="true"
                     pTooltip="Rol base del sistema: se pueden ajustar sus permisos, pero no eliminarlo." />
            }
          </td>
          <td class="tenue">{{ rol.descripcion || '—' }}</td>
          <td class="centrado">{{ rol.permisos?.length ?? 0 }}</td>
          <td class="centrado">{{ rol.usuarios ?? 0 }}</td>
          <td class="acciones">
            <button pButton [routerLink]="['/roles', rol.id]" text rounded
                    [icon]="rol.puede_editarse ? 'pi pi-pencil' : 'pi pi-eye'"
                    [pTooltip]="rol.puede_editarse ? 'Editar permisos' : 'Ver permisos'"></button>

            <button pButton icon="pi pi-copy" text rounded
                    *appTienePermiso="'roles.crear'"
                    pTooltip="Duplicar" (click)="duplicar(rol)"></button>

            <button pButton icon="pi pi-trash" text rounded severity="danger"
                    *appTienePermiso="'roles.eliminar'"
                    [disabled]="!rol.puede_eliminarse"
                    [pTooltip]="rol.puede_eliminarse
                      ? 'Eliminar rol'
                      : 'No se puede eliminar: está en uso o es un rol de sistema'"
                    (click)="eliminar(rol)"></button>
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="5" class="vacio">
          No hay roles que coincidan con la búsqueda.
        </td></tr>
      </ng-template>
    </p-table>
  `,
  styles: [`
    .encabezado { display:flex; justify-content:space-between; align-items:flex-start;
                  gap:2rem; margin-bottom:1.5rem; }
    .encabezado h1 { margin:0 0 .25rem; font-size:1.4rem; font-weight:600; }
    .encabezado p  { margin:0; max-width:52ch; color:var(--text-color-secondary);
                     font-size:.875rem; line-height:1.5; }
    .nombre-rol { font-weight:500; margin-right:.5rem; }
    .tenue { color:var(--text-color-secondary); }
    .centrado { text-align:center; }
    .acciones { text-align:right; white-space:nowrap; }
    .vacio { text-align:center; padding:2.5rem; color:var(--text-color-secondary); }
  `],
})
export class RolListaComponent {
  private readonly servicio = inject(RolService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);
  private readonly confirmar = inject(ConfirmationService);

  readonly roles = signal<Rol[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);

  private texto = '';
  private temporizador?: ReturnType<typeof setTimeout>;

  cargar(desde = 0): void {
    this.cargando.set(true);

    this.servicio.listar(this.texto, Math.floor(desde / 15) + 1).subscribe({
      next: res => {
        this.roles.set(res.data);
        this.total.set(res.meta.total);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  buscar(texto: string): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.texto = texto;
      this.cargar(0);
    }, 300);
  }

  duplicar(rol: Rol): void {
    this.servicio.duplicar(rol.id).subscribe(copia => {
      this.mensajes.add({
        severity: 'success',
        summary: 'Rol duplicado',
        detail: `Se creó "${copia.name}". Ajuste sus permisos antes de asignarlo.`,
      });
      this.router.navigate(['/roles', copia.id]);
    });
  }

  eliminar(rol: Rol): void {
    this.confirmar.confirm({
      header: 'Eliminar rol',
      message: `Se eliminará el rol "${rol.name}". Esta acción no se puede deshacer.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.servicio.eliminar(rol.id).subscribe(() => {
        this.mensajes.add({ severity: 'success', summary: 'Rol eliminado', detail: rol.name });
        this.cargar(0);
      }),
    });
  }
}
