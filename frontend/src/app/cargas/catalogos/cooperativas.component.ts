import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { Cooperativa, Municipio } from '../core/models/cargas.model';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';

@Component({
  selector: 'app-cooperativas',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule, DropdownModule,
    InputTextModule, CheckboxModule, TagModule, ToastModule, ConfirmDialogModule, TienePermisoDirective,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <header class="encabezado">
      <div>
        <h2>Cooperativas</h2>
        <p class="subtitulo">
          Cada cooperativa tiene su propio aporte por convenio (se define en Retenciones).
          El nombre no se repite aunque se escriba con otras mayúsculas o espacios.
        </p>
      </div>
      <div class="acciones" *appTienePermiso="'cargas.catalogos'">
        <p-button label="Nueva cooperativa" icon="pi pi-plus" (onClick)="abrirNueva()" />
      </div>
    </header>

    <div class="barra">
      <span class="campo-busqueda">
        <i class="pi pi-search"></i>
        <input pInputText placeholder="Nombre, sigla, NIT o NIM…" #busqueda
               (input)="tabla.filterGlobal(busqueda.value, 'contains')" />
      </span>
    </div>

    <p-table #tabla [value]="cooperativas()" [loading]="cargando()" [paginator]="true" [rows]="20"
             [globalFilterFields]="['nombre', 'sigla', 'nit', 'nim']" dataKey="id"
             styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th>Cooperativa</th>
          <th style="width: 10rem">NIT / NIM</th>
          <th style="width: 12rem">Municipio</th>
          <th style="width: 8rem" class="derecha">Productores</th>
          <th style="width: 6rem" class="derecha">Minas</th>
          <th style="width: 7rem" class="centro">Estado</th>
          <th style="width: 6rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-c>
        <tr [class.inactiva]="!c.activa">
          <td>
            <div>{{ c.nombre }}</div>
            <div class="secundario" *ngIf="c.sigla">{{ c.sigla }}</div>
          </td>
          <td>
            <div class="codigo" *ngIf="c.nit">{{ c.nit }}</div>
            <div class="secundario" *ngIf="c.nim">NIM {{ c.nim }}</div>
            <span class="guion" *ngIf="!c.nit && !c.nim">—</span>
          </td>
          <td>{{ c.municipio?.nombre ?? '—' }}</td>
          <td class="derecha contador">{{ c.productores_activos }}</td>
          <td class="derecha contador">{{ c.minas_activas }}</td>
          <td class="centro">
            <p-tag [value]="c.activa ? 'Activa' : 'Inactiva'" [severity]="c.activa ? 'success' : 'secondary'" />
          </td>
          <td class="centro">
            <ng-container *appTienePermiso="'cargas.catalogos'">
              <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" size="small" (onClick)="abrirEdicion(c)" />
              <p-button icon="pi pi-ban" [text]="true" [rounded]="true" size="small" severity="danger"
                        [disabled]="!c.activa" (onClick)="confirmarDesactivar(c)" />
            </ng-container>
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="7">
          <div class="vacio">
            <i class="pi pi-sitemap"></i>
            <p class="titulo-vacio">Sin cooperativas registradas</p>
          </div>
        </td></tr>
      </ng-template>
    </p-table>

    <p-dialog [(visible)]="dialogVisible" [header]="editando() ? 'Editar cooperativa' : 'Nueva cooperativa'"
              [modal]="true" [style]="{ width: '36rem' }" [draggable]="false">
      <form [formGroup]="form" class="campos">
        <div class="campo span-4">
          <label for="nombre">Nombre</label>
          <input id="nombre" pInputText formControlName="nombre" maxlength="150" placeholder="Unificada R.L." />
        </div>
        <div class="campo span-2">
          <label for="sigla">Sigla</label>
          <input id="sigla" pInputText formControlName="sigla" maxlength="30" />
        </div>
        <div class="campo span-3">
          <label for="nit">NIT</label>
          <input id="nit" pInputText formControlName="nit" maxlength="20" />
        </div>
        <div class="campo span-3">
          <label for="nim">NIM</label>
          <input id="nim" pInputText formControlName="nim" maxlength="30" />
        </div>
        <div class="campo span-6">
          <label for="municipio">Municipio</label>
          <p-dropdown inputId="municipio" formControlName="municipio_id" [options]="municipios()"
                      optionLabel="nombre" optionValue="id" [filter]="true" filterBy="nombre"
                      [showClear]="true" placeholder="Seleccione" appendTo="body" />
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
  `,
  styles: [ESTILOS_CARGAS],
})
export class CooperativasComponent implements OnInit {
  private readonly servicio = inject(CatalogosCargasService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly cooperativas = signal<Cooperativa[]>([]);
  readonly municipios = signal<Municipio[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly editando = signal<Cooperativa | null>(null);
  dialogVisible = false;

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    sigla: [''],
    nit: [''],
    nim: [''],
    municipio_id: [null as number | null],
    activa: [true],
  });

  ngOnInit(): void {
    this.servicio.listarMunicipios().subscribe((m) => this.municipios.set(m));
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listarCooperativas().subscribe({
      next: (c) => { this.cooperativas.set(c); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  abrirNueva(): void {
    this.editando.set(null);
    this.form.reset({ activa: true });
    this.dialogVisible = true;
  }

  abrirEdicion(c: Cooperativa): void {
    this.editando.set(c);
    this.form.reset(c as any);
    this.dialogVisible = true;
  }

  guardar(): void {
    this.guardando.set(true);
    this.servicio.guardarCooperativa(this.form.getRawValue() as Partial<Cooperativa>, this.editando()?.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogVisible = false;
        this.toast.add({ severity: 'success', summary: 'Cooperativa guardada' });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo guardar', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }

  confirmarDesactivar(c: Cooperativa): void {
    this.confirm.confirm({
      header: 'Desactivar cooperativa',
      message: `¿Desactivar «${c.nombre}»? Solo se puede si ya no tiene productores ni minas activos.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      accept: () => this.servicio.desactivarCooperativa(c.id).subscribe({
        next: () => { this.toast.add({ severity: 'info', summary: 'Cooperativa desactivada' }); this.cargar(); },
        error: (e) => this.toast.add({ severity: 'warn', summary: 'No se desactivó', detail: mensajeDeError(e), life: 8000 }),
      }),
    });
  }
}
