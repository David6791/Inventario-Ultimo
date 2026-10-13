import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CatalogoService } from '../../core/services/catalogo.service';
import { OrganizacionService } from '../../core/services/organizacion.service';
import { Ubicacion } from '../../core/models/catalogo.model';
import { CentroCosto } from '../../core/models/organizacion.model';
import { ESTILOS_CONFIG } from '../../core/estilos/configuracion.estilos';

@Component({
  selector: 'app-ubicaciones',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule,
    DropdownModule, InputTextModule, TagModule, ToastModule, ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <header class="encabezado">
      <div>
        <h2>Ubicaciones</h2>
        <p class="subtitulo">
          Dónde está físicamente cada bien. El centro de costo al que pertenece una
          ubicación define quién puede ver los activos que están ahí.
        </p>
      </div>
      <div class="acciones">
        <p-button label="Nueva ubicación" icon="pi pi-plus" (onClick)="abrirNueva()" />
      </div>
    </header>

    <div class="nota nota-encabezado">
      <i class="pi pi-sitemap"></i>
      <span>
        Las ubicaciones <strong>raíz</strong> requieren centro de costo; las que dependen
        de otra lo heredan. Así cada sitio pertenece a un centro sin repetirlo en cada piso.
      </span>
    </div>

    <div class="barra">
      <span class="campo-busqueda">
        <i class="pi pi-search"></i>
        <input pInputText placeholder="Código, nombre o ruta…" #busqueda
               (input)="tabla.filterGlobal(busqueda.value, 'contains')" />
      </span>
    </div>

    <p-table #tabla [value]="ubicaciones()" [loading]="cargando()" [paginator]="true" [rows]="20"
             [globalFilterFields]="['codigo', 'nombre', 'ruta']" dataKey="id"
             styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 9rem">Código</th>
          <th>Ubicación</th>
          <th style="width: 15rem">Centro de costo</th>
          <th style="width: 11rem">Ambiente</th>
          <th style="width: 7rem" class="centro">Estado</th>
          <th style="width: 6rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-u>
        <tr [class.inactiva]="!u.activo">
          <td><span class="codigo">{{ u.codigo }}</span></td>

          <td>
            <div class="ruta" *ngIf="rutaPadre(u)">{{ rutaPadre(u) }}</div>
            <div>{{ u.nombre }}</div>
          </td>

          <td>
            <span *ngIf="nombreCentro(u) as nombre; else heredado">{{ nombre }}</span>
            <ng-template #heredado>
              <span class="heredado" *ngIf="centroHeredado(u) as h">
                {{ h }} <small>heredado</small>
              </span>
              <span class="sin-ambito" *ngIf="!centroHeredado(u)">
                <i class="pi pi-exclamation-triangle"></i> sin centro
              </span>
            </ng-template>
          </td>

          <td>{{ u.ambiente || '—' }}</td>

          <td class="centro">
            <p-tag [value]="u.activo ? 'Activa' : 'Inactiva'"
                   [severity]="u.activo ? 'success' : 'secondary'" />
          </td>

          <td class="centro">
            <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" size="small"
                      (onClick)="abrirEdicion(u)" />
            <p-button icon="pi pi-ban" [text]="true" [rounded]="true" size="small" severity="danger"
                      [disabled]="!u.activo" (onClick)="confirmarDesactivar(u)" />
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="6">
          <div class="vacio">
            <i class="pi pi-map-marker"></i>
            <p class="titulo-vacio">Sin ubicaciones registradas</p>
            <p-button label="Crear la primera" icon="pi pi-plus" [text]="true" (onClick)="abrirNueva()" />
          </div>
        </td></tr>
      </ng-template>
    </p-table>

    <p-dialog [(visible)]="dialogVisible" [header]="editando() ? 'Editar ubicación' : 'Nueva ubicación'"
              [modal]="true" [style]="{ width: '38rem' }" [draggable]="false">
      <form [formGroup]="form" class="campos">
        <div class="campo span-2">
          <label for="codigo">Código</label>
          <input id="codigo" pInputText formControlName="codigo" maxlength="20" placeholder="OC-P2" />
        </div>

        <div class="campo span-4">
          <label for="nombre">Nombre</label>
          <input id="nombre" pInputText formControlName="nombre" placeholder="Primer piso" />
        </div>

        <div class="campo span-6">
          <label for="padre">Depende de</label>
          <p-dropdown inputId="padre" formControlName="padre_id" [options]="posiblesPadres()"
                      optionLabel="nombre" optionValue="id" placeholder="Ninguna (es raíz)"
                      [showClear]="true" [filter]="true" filterBy="nombre" appendTo="body"
                      (onChange)="alCambiarPadre()" />
          <small>Deje vacío si es un sitio independiente.</small>
        </div>

        <div class="campo span-6">
          <label for="centro">
            Centro de costo
            <span class="obligatorio" *ngIf="esRaiz()">obligatorio</span>
          </label>
          <p-dropdown inputId="centro" formControlName="centro_costo_id" [options]="centros()"
                      optionLabel="etiqueta" optionValue="id"
                      [placeholder]="esRaiz() ? 'Seleccione' : 'Heredar del padre'"
                      [showClear]="!esRaiz()" [filter]="true" filterBy="etiqueta"
                      appendTo="body" />
          <small *ngIf="esRaiz()">
            Define quién ve los bienes de esta ubicación y de las que dependan de ella.
          </small>
          <small *ngIf="!esRaiz()">
            Vacío hereda el centro del padre. Indique uno solo si esta ubicación
            pertenece a otro.
          </small>
        </div>

        <div class="campo span-3">
          <label for="ambiente">Ambiente</label>
          <input id="ambiente" pInputText formControlName="ambiente" />
        </div>

        <div class="campo span-3">
          <label for="sucursal">Sucursal</label>
          <input id="sucursal" pInputText formControlName="sucursal" />
        </div>

        <div class="campo span-6">
          <label for="direccion">Dirección</label>
          <input id="direccion" pInputText formControlName="direccion" />
        </div>
      </form>

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="dialogVisible = false" />
        <p-button label="Guardar" icon="pi pi-check" [disabled]="form.invalid || guardando()"
                  [loading]="guardando()" (onClick)="guardar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CONFIG, `
    .ruta {
      font-size: 0.72rem;
      color: var(--text-color-secondary, #9ca3af);
      margin-bottom: 0.1rem;
    }

    .heredado small {
      font-size: 0.68rem; font-style: italic;
      color: var(--text-color-secondary, #9ca3af);
      margin-left: 0.25rem;
    }

    .sin-ambito {
      display: inline-flex; align-items: center; gap: 0.3rem;
      font-size: 0.78rem; color: #b45309;
    }

    .obligatorio {
      font-size: 0.62rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.04em; color: #b45309; background: #fef3c7;
      padding: 0.08rem 0.35rem; border-radius: 3px; margin-left: 0.4rem;
    }
  `],
})
export class UbicacionesComponent implements OnInit {
  private readonly servicio = inject(CatalogoService);
  private readonly organizacion = inject(OrganizacionService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly ubicaciones = signal<Ubicacion[]>([]);
  readonly centros = signal<CentroCosto[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly editando = signal<Ubicacion | null>(null);
  readonly padreId = signal<number | null>(null);

  dialogVisible = false;

  readonly form = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(20)]],
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    padre_id: [null as number | null],
    centro_costo_id: [null as number | null, Validators.required],
    sucursal: [''],
    ambiente: [''],
    direccion: [''],
  });

  ngOnInit(): void {
    this.organizacion.listarCentros().subscribe({
      next: (c) => this.centros.set(c),
      error: () => this.toast.add({
        severity: 'warn',
        summary: 'No se pudo cargar la lista de centros de costo',
      }),
    });

    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listarUbicaciones().subscribe({
      next: (data) => { this.ubicaciones.set(data); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  /** Una raíz necesita centro propio; una hija lo hereda del padre. */
  esRaiz(): boolean {
    return this.padreId() === null;
  }

  alCambiarPadre(): void {
    this.padreId.set(this.form.value.padre_id ?? null);

    const centro = this.form.get('centro_costo_id');

    if (this.esRaiz()) {
      centro?.addValidators(Validators.required);
    } else {
      centro?.clearValidators();
    }

    centro?.updateValueAndValidity();
  }

  nombreCentro(u: any): string | null {
    if (!u.centro_costo_id) return null;
    return this.centros().find((c) => c.id === u.centro_costo_id)?.codigo ?? null;
  }

  /** Sube por el árbol hasta encontrar un ancestro con centro. */
  centroHeredado(u: any): string | null {
    let nodo: any = this.ubicaciones().find((x) => x.id === u.padre_id);

    while (nodo) {
      if (nodo.centro_costo_id) {
        return this.centros().find((c) => c.id === nodo.centro_costo_id)?.codigo ?? null;
      }
      nodo = this.ubicaciones().find((x) => x.id === nodo.padre_id);
    }

    return null;
  }

  rutaPadre(u: Ubicacion): string {
    if (!u.ruta) return '';
    const partes = u.ruta.split(' / ');
    partes.pop();
    return partes.join(' / ');
  }

  posiblesPadres(): Ubicacion[] {
    const actual = this.editando();
    return this.ubicaciones().filter((u) => u.activo && u.id !== actual?.id);
  }

  abrirNueva(): void {
    this.editando.set(null);
    this.padreId.set(null);
    this.form.reset();
    this.alCambiarPadre();
    this.dialogVisible = true;
  }

  abrirEdicion(u: Ubicacion): void {
    this.editando.set(u);
    this.padreId.set(u.padre_id);
    this.form.patchValue(u as any);
    this.alCambiarPadre();
    this.dialogVisible = true;
  }

  guardar(): void {
    this.guardando.set(true);

    const datos = this.form.value as Partial<Ubicacion>;
    const actual = this.editando();

    const alGuardar = () => {
      this.guardando.set(false);
      this.dialogVisible = false;
      this.toast.add({ severity: 'success', summary: 'Ubicación guardada' });
      this.cargar();
    };

    const alFallar = (e: any) => {
      this.guardando.set(false);
      this.toast.add({
        severity: 'error',
        summary: 'No se pudo guardar',
        detail: e?.error?.message ?? this.primerError(e) ?? 'Revise los datos.',
        life: 8000,
      });
    };

    if (actual) {
      this.servicio.actualizarUbicacion(actual.id, datos)
        .subscribe({ next: alGuardar, error: alFallar });
    } else {
      this.servicio.crearUbicacion(datos)
        .subscribe({ next: alGuardar, error: alFallar });
    }
  }

  private primerError(e: any): string | null {
    const errores = e?.error?.errors;
    if (!errores) return null;
    return (Object.values(errores)[0] as string[])?.[0] ?? null;
  }

  confirmarDesactivar(u: Ubicacion): void {
    this.confirm.confirm({
      header: 'Desactivar ubicación',
      message: `¿Desactivar «${u.nombre}»? No se puede si tiene ubicaciones dependientes activas.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      accept: () =>
        this.servicio.desactivarUbicacion(u.id).subscribe({
          next: (r: any) => {
            this.toast.add({ severity: 'info', summary: r?.mensaje ?? 'Ubicación desactivada' });
            this.cargar();
          },
          error: (e: any) =>
            this.toast.add({
              severity: 'warn', summary: 'No se desactivó',
              detail: e?.error?.mensaje ?? 'Tiene dependencias activas.',
            }),
        }),
    });
  }
}