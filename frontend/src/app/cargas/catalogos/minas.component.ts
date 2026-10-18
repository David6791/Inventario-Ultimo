import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { Bocamina, Cooperativa, Mina, Municipio } from '../core/models/cargas.model';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';

/**
 * Minas de cooperativas, de particulares y propias de la empresa. Las propias
 * tienen bocaminas: cada lote de producción propia sale de una de ellas.
 */
@Component({
  selector: 'app-minas',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule,
    DropdownModule, InputTextModule, CheckboxModule, SelectButtonModule, TagModule, ToastModule,
    ConfirmDialogModule, TienePermisoDirective,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <header class="encabezado">
      <div>
        <h2>Minas y bocaminas</h2>
        <p class="subtitulo">
          El municipio de la mina define a quién va la regalía. Las minas propias de la
          empresa no pertenecen a una cooperativa y registran sus bocaminas.
        </p>
      </div>
      <div class="acciones" *appTienePermiso="'cargas.catalogos'">
        <p-button label="Nueva mina" icon="pi pi-plus" (onClick)="abrirNueva()" />
      </div>
    </header>

    <div class="barra">
      <span class="campo-busqueda">
        <i class="pi pi-search"></i>
        <input pInputText placeholder="Nombre de la mina o cooperativa…" #busqueda
               (input)="tabla.filterGlobal(busqueda.value, 'contains')" />
      </span>
      <p-selectButton [options]="vistas" [(ngModel)]="vista" optionLabel="etiqueta" optionValue="valor" />
    </div>

    <p-table #tabla [value]="filtradas()" [loading]="cargando()" [paginator]="true" [rows]="20"
             [globalFilterFields]="['nombre', 'cooperativa.nombre', 'municipio.nombre']" dataKey="id"
             styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th>Mina</th>
          <th style="width: 16rem">Cooperativa</th>
          <th style="width: 12rem">Municipio</th>
          <th style="width: 9rem" class="derecha">Bocaminas</th>
          <th style="width: 7rem" class="centro">Estado</th>
          <th style="width: 8rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-m>
        <tr [class.inactiva]="!m.activa">
          <td>
            {{ m.nombre }}
            <span class="pastilla pastilla-acento" *ngIf="m.propia">Propia</span>
          </td>
          <td>{{ m.cooperativa?.nombre ?? (m.propia ? '' : 'Particular') }}</td>
          <td>
            <span *ngIf="m.municipio; else sinMunicipio">{{ m.municipio.nombre }}</span>
            <ng-template #sinMunicipio><span class="pastilla pastilla-aviso">sin municipio</span></ng-template>
          </td>
          <td class="derecha contador">{{ m.bocaminas_activas }}</td>
          <td class="centro">
            <p-tag [value]="m.activa ? 'Activa' : 'Inactiva'" [severity]="m.activa ? 'success' : 'secondary'" />
          </td>
          <td class="centro">
            <p-button icon="pi pi-th-large" [text]="true" [rounded]="true" size="small"
                      (onClick)="abrirBocaminas(m)" />
            <ng-container *appTienePermiso="'cargas.catalogos'">
              <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" size="small" (onClick)="abrirEdicion(m)" />
              <p-button icon="pi pi-ban" [text]="true" [rounded]="true" size="small" severity="danger"
                        [disabled]="!m.activa" (onClick)="confirmarDesactivar(m)" />
            </ng-container>
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="6">
          <div class="vacio">
            <i class="pi pi-map"></i>
            <p class="titulo-vacio">Sin minas en esta vista</p>
          </div>
        </td></tr>
      </ng-template>
    </p-table>

    <!-- Mina -->
    <p-dialog [(visible)]="dialogVisible" [header]="editando() ? 'Editar mina' : 'Nueva mina'"
              [modal]="true" [style]="{ width: '36rem' }" [draggable]="false">
      <form [formGroup]="form" class="campos">
        <div class="campo span-6">
          <label for="nombre">Nombre</label>
          <input id="nombre" pInputText formControlName="nombre" maxlength="150" />
        </div>
        <div class="campo span-6 check-campo">
          <p-checkbox formControlName="propia" [binary]="true" inputId="propia" (onChange)="alCambiarPropia()" />
          <label for="propia">Mina propia de la empresa (su mineral entra como producción propia)</label>
        </div>
        <div class="campo span-6">
          <label for="cooperativa">Cooperativa</label>
          <p-dropdown inputId="cooperativa" formControlName="cooperativa_id" [options]="cooperativas()"
                      optionLabel="nombre" optionValue="id" [filter]="true" filterBy="nombre" [showClear]="true"
                      [placeholder]="form.value.propia ? 'No corresponde' : 'Ninguna (mina de un particular)'"
                      appendTo="body" />
        </div>
        <div class="campo span-6">
          <label for="municipio">Municipio</label>
          <p-dropdown inputId="municipio" formControlName="municipio_id" [options]="municipios()"
                      optionLabel="nombre" optionValue="id" [filter]="true" filterBy="nombre"
                      [showClear]="true" placeholder="Seleccione" appendTo="body" />
          <small>Define el reparto de la regalía (85 % Gobernación, 15 % municipio productor).</small>
        </div>
        <div class="campo span-6 check-campo" *ngIf="editando()">
          <p-checkbox formControlName="activa" [binary]="true" inputId="activa" />
          <label for="activa">Activa</label>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="dialogVisible = false" />
        <p-button label="Guardar" icon="pi pi-check" [disabled]="form.invalid || guardando()"
                  [loading]="guardando()" (onClick)="guardar()" />
      </ng-template>
    </p-dialog>

    <!-- Bocaminas -->
    <p-dialog [(visible)]="bocaminasVisible" [header]="'Bocaminas de ' + (minaActual()?.nombre ?? '')"
              [modal]="true" [style]="{ width: '40rem' }" [draggable]="false">
      <div class="nota nota-neutra nota-encabezado" *ngIf="!minaActual()?.propia">
        <i class="pi pi-info-circle"></i>
        <span>Las bocaminas son obligatorias solo en minas propias, pero se pueden registrar en cualquiera.</span>
      </div>

      <p-table [value]="bocaminas()" styleClass="p-datatable-sm tabla">
        <ng-template pTemplate="header">
          <tr><th style="width: 9rem">Código</th><th>Nombre</th><th style="width: 7rem" class="centro">Estado</th><th style="width: 4rem"></th></tr>
        </ng-template>
        <ng-template pTemplate="body" let-b>
          <tr [class.inactiva]="!b.activa">
            <td><span class="codigo">{{ b.codigo }}</span></td>
            <td>{{ b.nombre || '—' }}</td>
            <td class="centro"><p-tag [value]="b.activa ? 'Activa' : 'Inactiva'" [severity]="b.activa ? 'success' : 'secondary'" /></td>
            <td class="centro">
              <p-button *appTienePermiso="'cargas.catalogos'" [icon]="b.activa ? 'pi pi-ban' : 'pi pi-check'"
                        [text]="true" [rounded]="true" size="small" [severity]="b.activa ? 'danger' : 'success'"
                        (onClick)="alternarBocamina(b)" />
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="4"><p class="titulo-vacio centro">Sin bocaminas registradas.</p></td></tr>
        </ng-template>
      </p-table>

      <form [formGroup]="formBocamina" class="campos nueva-bocamina" *appTienePermiso="'cargas.catalogos'">
        <div class="campo span-2">
          <label for="bm-codigo">Código</label>
          <input id="bm-codigo" pInputText formControlName="codigo" maxlength="20" placeholder="BM-1" />
        </div>
        <div class="campo span-3">
          <label for="bm-nombre">Nombre</label>
          <input id="bm-nombre" pInputText formControlName="nombre" maxlength="100" placeholder="Nivel 2, veta San José" />
        </div>
        <div class="campo span-1 boton-agregar">
          <p-button icon="pi pi-plus" [disabled]="formBocamina.invalid" (onClick)="agregarBocamina()" />
        </div>
      </form>
    </p-dialog>
  `,
  styles: [ESTILOS_CARGAS, `
    .pastilla { margin-left: 0.4rem; }
    .nueva-bocamina { margin-top: 1rem; }
    .boton-agregar { justify-content: flex-end; }
  `],
})
export class MinasComponent implements OnInit {
  private readonly servicio = inject(CatalogosCargasService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly minas = signal<Mina[]>([]);
  readonly cooperativas = signal<Cooperativa[]>([]);
  readonly municipios = signal<Municipio[]>([]);
  readonly bocaminas = signal<Bocamina[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly editando = signal<Mina | null>(null);
  readonly minaActual = signal<Mina | null>(null);
  readonly vistaActual = signal<'todas' | 'propias' | 'ajenas'>('todas');

  readonly vistas = [
    { valor: 'todas', etiqueta: 'Todas' },
    { valor: 'propias', etiqueta: 'Propias' },
    { valor: 'ajenas', etiqueta: 'De terceros' },
  ];

  get vista() { return this.vistaActual(); }
  set vista(v: 'todas' | 'propias' | 'ajenas') { this.vistaActual.set(v); }

  readonly filtradas = computed(() => {
    const v = this.vistaActual();
    return this.minas().filter((m) => v === 'todas' || (v === 'propias') === m.propia);
  });

  dialogVisible = false;
  bocaminasVisible = false;

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    propia: [false],
    cooperativa_id: [null as number | null],
    municipio_id: [null as number | null],
    activa: [true],
  });

  readonly formBocamina = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(20)]],
    nombre: [''],
  });

  ngOnInit(): void {
    this.servicio.listarCooperativas(true).subscribe((c) => this.cooperativas.set(c));
    this.servicio.listarMunicipios().subscribe((m) => this.municipios.set(m));
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listarMinas().subscribe({
      next: (m) => { this.minas.set(m); this.cargando.set(false); },
      error: (e) => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo cargar la lista', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }

  alCambiarPropia(): void {
    const coop = this.form.get('cooperativa_id')!;
    if (this.form.value.propia) {
      coop.setValue(null);
      coop.disable();
    } else {
      coop.enable();
    }
  }

  abrirNueva(): void {
    this.editando.set(null);
    this.form.reset({ propia: false, activa: true });
    this.alCambiarPropia();
    this.dialogVisible = true;
  }

  abrirEdicion(m: Mina): void {
    this.editando.set(m);
    this.form.reset(m as any);
    this.alCambiarPropia();
    this.dialogVisible = true;
  }

  guardar(): void {
    this.guardando.set(true);
    this.servicio.guardarMina(this.form.getRawValue() as Partial<Mina>, this.editando()?.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogVisible = false;
        this.toast.add({ severity: 'success', summary: 'Mina guardada' });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo guardar', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }

  confirmarDesactivar(m: Mina): void {
    this.confirm.confirm({
      header: 'Desactivar mina',
      message: `¿Desactivar «${m.nombre}»? Primero hay que desactivar sus bocaminas.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      accept: () => this.servicio.desactivarMina(m.id).subscribe({
        next: () => { this.toast.add({ severity: 'info', summary: 'Mina desactivada' }); this.cargar(); },
        error: (e) => this.toast.add({ severity: 'warn', summary: 'No se desactivó', detail: mensajeDeError(e), life: 8000 }),
      }),
    });
  }

  // ------------------------------------------------------------- Bocaminas

  abrirBocaminas(m: Mina): void {
    this.minaActual.set(m);
    this.formBocamina.reset();
    this.bocaminas.set([]);
    this.bocaminasVisible = true;
    this.cargarBocaminas();
  }

  private cargarBocaminas(): void {
    const mina = this.minaActual();
    if (mina) {
      this.servicio.listarBocaminas(mina.id).subscribe((b) => this.bocaminas.set(b));
    }
  }

  agregarBocamina(): void {
    const mina = this.minaActual();
    if (!mina) return;

    this.servicio.crearBocamina(mina.id, this.formBocamina.getRawValue() as Partial<Bocamina>).subscribe({
      next: () => { this.formBocamina.reset(); this.cargarBocaminas(); this.cargar(); },
      error: (e) => this.toast.add({ severity: 'error', summary: 'No se agregó', detail: mensajeDeError(e), life: 8000 }),
    });
  }

  alternarBocamina(b: Bocamina): void {
    this.servicio.actualizarBocamina(b.id, { codigo: b.codigo, nombre: b.nombre, activa: !b.activa }).subscribe({
      next: () => { this.cargarBocaminas(); this.cargar(); },
      error: (e) => this.toast.add({ severity: 'error', summary: 'No se guardó', detail: mensajeDeError(e) }),
    });
  }
}
