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
import { Ubicacion } from '../../core/models/catalogo.model';
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
          Dónde está físicamente cada bien. Se verifican contra la realidad en la toma física,
          y la diferencia entre lo registrado y lo encontrado es el hallazgo más común.
        </p>
      </div>
      <div class="acciones">
        <p-button label="Nueva ubicación" icon="pi pi-plus" (onClick)="abrirNueva()" />
      </div>
    </header>

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
          <th style="width: 11rem">Sucursal</th>
          <th style="width: 11rem">Ambiente</th>
          <th style="width: 7rem" class="centro">Estado</th>
          <th style="width: 10rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-u>
        <tr [class.inactiva]="!u.activo">
          <td><span class="codigo">{{ u.codigo }}</span></td>

          <td>
            <div class="ruta" *ngIf="u.ruta && u.ruta !== u.nombre">{{ rutaPadre(u) }}</div>
            <div>{{ u.nombre }}</div>
          </td>

          <td>{{ u.sucursal || '—' }}</td>
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
              [modal]="true" [style]="{ width: '36rem' }" [draggable]="false">
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
                      [showClear]="true" [filter]="true" filterBy="nombre" appendTo="body" />
          <small>La jerarquía arma la ruta completa: Oficina Central / Primer piso / Contabilidad.</small>
        </div>

        <div class="campo span-3">
          <label for="sucursal">Sucursal</label>
          <input id="sucursal" pInputText formControlName="sucursal" />
        </div>

        <div class="campo span-3">
          <label for="ambiente">Ambiente</label>
          <input id="ambiente" pInputText formControlName="ambiente" />
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
  `],
})
export class UbicacionesComponent implements OnInit {
  private readonly servicio = inject(CatalogoService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly ubicaciones = signal<Ubicacion[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly editando = signal<Ubicacion | null>(null);

  dialogVisible = false;

  readonly form = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(20)]],
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    padre_id: [null as number | null],
    sucursal: [''],
    ambiente: [''],
    direccion: [''],
  });

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listarUbicaciones().subscribe({
      next: (data) => { this.ubicaciones.set(data); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  /** La ruta sin el último segmento: el nombre ya se muestra debajo. */
  rutaPadre(u: Ubicacion): string {
    if (!u.ruta) return '';
    const partes = u.ruta.split(' / ');
    partes.pop();
    return partes.join(' / ');
  }

  /** Una ubicación no puede ser su propio padre. */
  posiblesPadres(): Ubicacion[] {
    const actual = this.editando();
    return this.ubicaciones().filter((u) => u.activo && u.id !== actual?.id);
  }

  abrirNueva(): void {
    this.editando.set(null);
    this.form.reset();
    this.dialogVisible = true;
  }

  abrirEdicion(u: Ubicacion): void {
    this.editando.set(u);
    this.form.patchValue(u);
    this.dialogVisible = true;
  }

  guardar(): void {
    this.guardando.set(true);
    const datos = this.form.value as Partial<Ubicacion>;
    const actual = this.editando();

    const peticion = actual
      ? this.servicio.actualizarUbicacion(actual.id, datos)
      : this.servicio.crearUbicacion(datos);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogVisible = false;
        this.toast.add({ severity: 'success', summary: 'Ubicación guardada' });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({
          severity: 'error', summary: 'No se pudo guardar',
          detail: e?.error?.message ?? 'Revise los datos ingresados.',
        });
      },
    });
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
          next: (r) => {
            this.toast.add({ severity: 'info', summary: r.mensaje ?? 'Ubicación desactivada' });
            this.cargar();
          },
          error: (e) =>
            this.toast.add({
              severity: 'warn', summary: 'No se desactivó',
              detail: e?.error?.mensaje ?? 'Tiene dependencias activas.',
            }),
        }),
    });
  }
}
