import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Almacen, Usuario } from '../../core/models/auth.models';
import { PermisosService } from '../../core/services/permisos.service';
import { RolService } from '../../core/services/rol.service';
import { FiltroUsuarios, UsuarioService } from '../../core/services/usuario.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-usuario-lista',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, TableModule, ButtonModule, InputTextModule,
    DropdownModule, TagModule, TooltipModule, DialogModule, InputSwitchModule, TienePermisoDirective,
  ],
  template: `
    <header class="encabezado">
      <div>
        <h1>Usuarios</h1>
        <p>El rol define qué puede hacer cada persona; los almacenes asignados
           definen dónde.</p>
      </div>
      <button pButton routerLink="/usuarios/nuevo" icon="pi pi-plus"
              label="Registrar usuario" *appTienePermiso="'usuarios.crear'"></button>
    </header>

    <p-table [value]="usuarios()" [loading]="cargando()" [paginator]="true" [rows]="15"
             [totalRecords]="total()" [lazy]="true" (onLazyLoad)="cargar($event.first ?? 0)"
             dataKey="id" styleClass="p-datatable-sm">

      <ng-template pTemplate="caption">
        <div class="filtros">
          <span class="p-input-icon-left">
            <i class="pi pi-search"></i>
            <input pInputText type="search" placeholder="Nombre, correo o carnet"
                   (input)="buscar($any($event.target).value)" />
          </span>

          <p-dropdown [options]="roles()" [(ngModel)]="filtro.rol" optionLabel="name"
                      optionValue="name" placeholder="Todos los roles" [showClear]="true"
                      (onChange)="cargar(0)" />

          <p-dropdown [options]="almacenes()" [(ngModel)]="filtro.almacen_id" optionLabel="nombre"
                      optionValue="id" placeholder="Todos los almacenes" [showClear]="true"
                      (onChange)="cargar(0)" />

          <p-dropdown [options]="estados" [(ngModel)]="filtro.activo" optionLabel="etiqueta"
                      optionValue="valor" placeholder="Activos e inactivos" [showClear]="true"
                      (onChange)="cargar(0)" />
        </div>
      </ng-template>

      <ng-template pTemplate="header">
        <tr>
          <th style="width:24%">Usuario</th>
          <th style="width:16%">Roles</th>
          <th>Almacenes</th>
          <th style="width:13%">Último acceso</th>
          <th style="width:8%" class="centrado">Activo</th>
          <th style="width:9%"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-usuario>
        <tr [class.inactivo]="!usuario.activo">
          <td>
            <div class="persona">
              <span class="nombre">{{ usuario.name }}</span>
              <span class="correo">{{ usuario.email }}</span>
            </div>
          </td>

          <td>
            @for (rol of usuario.roles; track rol.id) {
              <p-tag [value]="rol.name" severity="info" [rounded]="true" styleClass="etiqueta" />
            }
          </td>

          <td class="tenue">
            @if (usuario.almacenes?.length) {
              {{ nombresAlmacenes(usuario) }}
            } @else {
              <span class="alerta">
                <i class="pi pi-exclamation-triangle"></i> Sin almacén asignado
              </span>
            }
          </td>

          <td class="tenue">{{ usuario.ultimo_acceso_en ? (usuario.ultimo_acceso_en | date:'dd/MM/yy HH:mm') : 'Nunca ingresó' }}</td>

          <td class="centrado">
            <p-inputSwitch [ngModel]="usuario.activo" *appTienePermiso="'usuarios.desactivar'"
                           (ngModelChange)="cambiarEstado(usuario, $event)" />
          </td>

          <td class="acciones">
            <button pButton icon="pi pi-pencil" text rounded
                    [routerLink]="['/usuarios', usuario.id]" pTooltip="Editar"></button>

            <button pButton icon="pi pi-key" text rounded severity="warning"
                    *appTienePermiso="'usuarios.restablecer-clave'"
                    pTooltip="Restablecer contraseña"
                    (click)="restablecer(usuario)"></button>
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="6" class="vacio">
          Ningún usuario coincide con estos filtros.
        </td></tr>
      </ng-template>
    </p-table>

    <p-dialog header="Contraseña restablecida" [(visible)]="mostrarClave" [modal]="true"
              [style]="{ width: '26rem' }" [draggable]="false">
      <p>Entregue esta contraseña temporal a <strong>{{ nombreRestablecido }}</strong>.
         El sistema le pedirá cambiarla al ingresar.</p>
      <div class="clave-temporal">
        <code>{{ claveTemporal }}</code>
        <button pButton icon="pi pi-copy" text (click)="copiar()" pTooltip="Copiar"></button>
      </div>
      <p class="aviso">Esta contraseña no se vuelve a mostrar.</p>
    </p-dialog>
  `,
  styles: [`
    .encabezado { display:flex; justify-content:space-between; align-items:flex-start;
                  gap:2rem; margin-bottom:1.5rem; }
    .encabezado h1 { margin:0 0 .25rem; font-size:1.4rem; font-weight:600; }
    .encabezado p  { margin:0; max-width:52ch; color:var(--text-color-secondary);
                     font-size:.875rem; line-height:1.5; }

    .filtros { display:flex; gap:.625rem; flex-wrap:wrap; }
    .persona { display:flex; flex-direction:column; }
    .nombre { font-weight:500; }
    .correo { font-size:.75rem; color:var(--text-color-secondary); }
    .tenue  { color:var(--text-color-secondary); font-size:.875rem; }
    .alerta { color:var(--orange-500); font-size:.8125rem; }
    .centrado { text-align:center; }
    .acciones { text-align:right; white-space:nowrap; }
    .inactivo { opacity:.55; }
    :host ::ng-deep .etiqueta { margin-right:.25rem; }
    .vacio { text-align:center; padding:2.5rem; color:var(--text-color-secondary); }

    .clave-temporal { display:flex; align-items:center; gap:.5rem;
                      background:var(--surface-100); padding:.625rem .875rem;
                      border-radius:6px; margin:.75rem 0; }
    .clave-temporal code { font-size:1.05rem; letter-spacing:.05em; }
    .aviso { font-size:.8125rem; color:var(--text-color-secondary); margin:0; }
  `],
})
export class UsuarioListaComponent {
  private readonly servicio = inject(UsuarioService);
  private readonly rolServicio = inject(RolService);
  private readonly permisos = inject(PermisosService);
  private readonly mensajes = inject(MessageService);
  private readonly confirmar = inject(ConfirmationService);

  readonly usuarios = signal<Usuario[]>([]);
  readonly almacenes = signal<Almacen[]>([]);
  readonly roles = signal<{ id: number; name: string }[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);

  readonly estados = [
    { etiqueta: 'Solo activos', valor: true },
    { etiqueta: 'Solo inactivos', valor: false },
  ];

  filtro: FiltroUsuarios = {};

  mostrarClave = false;
  claveTemporal = '';
  nombreRestablecido = '';

  private temporizador?: ReturnType<typeof setTimeout>;

  constructor() {
    this.servicio.almacenes().subscribe(res => this.almacenes.set(res.data));

    if (this.permisos.can('roles.ver')) {
      this.rolServicio.listar('', 1).subscribe(res => this.roles.set(res.data));
    }
  }

  cargar(desde = 0): void {
    this.cargando.set(true);

    this.servicio.listar(this.filtro, Math.floor(desde / 15) + 1).subscribe({
      next: res => {
        this.usuarios.set(res.data);
        this.total.set(res.meta.total);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  buscar(texto: string): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.filtro.buscar = texto;
      this.cargar(0);
    }, 300);
  }

  nombresAlmacenes(usuario: Usuario): string {
    return (usuario.almacenes ?? []).map(a => a.nombre).join(', ');
  }

  cambiarEstado(usuario: Usuario, activo: boolean): void {
    const accion = activo ? 'Activar' : 'Desactivar';

    this.confirmar.confirm({
      header: `${accion} usuario`,
      message: activo
        ? `${usuario.name} podrá volver a ingresar al sistema.`
        : `${usuario.name} no podrá ingresar y su sesión abierta se cerrará de inmediato. Sus movimientos registrados se conservan.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: accion,
      rejectLabel: 'Cancelar',
      accept: () => this.servicio.cambiarEstado(usuario.id, activo).subscribe(() => {
        this.mensajes.add({
          severity: 'success',
          summary: activo ? 'Usuario activado' : 'Usuario desactivado',
          detail: usuario.name,
        });
        this.cargar(0);
      }),
      reject: () => this.cargar(0),
    });
  }

  restablecer(usuario: Usuario): void {
    this.confirmar.confirm({
      header: 'Restablecer contraseña',
      message: `Se generará una contraseña temporal para ${usuario.name} y se cerrarán sus sesiones abiertas.`,
      icon: 'pi pi-key',
      acceptLabel: 'Restablecer',
      rejectLabel: 'Cancelar',
      accept: () => this.servicio.restablecerClave(usuario.id).subscribe(res => {
        this.claveTemporal = res.password_temporal;
        this.nombreRestablecido = usuario.name;
        this.mostrarClave = true;
      }),
    });
  }

  copiar(): void {
    navigator.clipboard.writeText(this.claveTemporal);
    this.mensajes.add({ severity: 'success', summary: 'Contraseña copiada' });
  }
}
