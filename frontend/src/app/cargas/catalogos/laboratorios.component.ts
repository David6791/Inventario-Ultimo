import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { Laboratorio } from '../core/models/cargas.model';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';

@Component({
  selector: 'app-laboratorios',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule, InputTextModule,
    CheckboxModule, TagModule, ToastModule, ConfirmDialogModule, TienePermisoDirective,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <header class="encabezado">
      <div>
        <h2>Laboratorios</h2>
        <p class="subtitulo">
          Donde se ensayan las muestras: el propio, los que traen los productores y los
          que hacen de dirimentes cuando los ensayes no coinciden.
        </p>
      </div>
      <div class="acciones" *appTienePermiso="'cargas.catalogos'">
        <p-button label="Nuevo laboratorio" icon="pi pi-plus" (onClick)="abrirNuevo()" />
      </div>
    </header>

    <p-table [value]="laboratorios()" [loading]="cargando()" dataKey="id" styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th>Laboratorio</th>
          <th style="width: 10rem">NIT</th>
          <th style="width: 14rem">Características</th>
          <th style="width: 7rem" class="centro">Estado</th>
          <th style="width: 6rem"></th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-l>
        <tr [class.inactiva]="!l.activo">
          <td>{{ l.nombre }}</td>
          <td><span class="codigo" *ngIf="l.nit; else guion">{{ l.nit }}</span></td>
          <td>
            <span class="pastilla pastilla-acento" *ngIf="l.propio">Propio</span>
            <span class="pastilla" *ngIf="l.acreditado">Acreditado</span>
          </td>
          <td class="centro">
            <p-tag [value]="l.activo ? 'Activo' : 'Inactivo'" [severity]="l.activo ? 'success' : 'secondary'" />
          </td>
          <td class="centro">
            <ng-container *appTienePermiso="'cargas.catalogos'">
              <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" size="small" (onClick)="abrirEdicion(l)" />
              <p-button icon="pi pi-ban" [text]="true" [rounded]="true" size="small" severity="danger"
                        [disabled]="!l.activo" (onClick)="desactivar(l)" />
            </ng-container>
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="5"><div class="vacio"><i class="pi pi-filter"></i>
          <p class="titulo-vacio">Sin laboratorios registrados</p></div></td></tr>
      </ng-template>
    </p-table>
    <ng-template #guion><span class="guion">—</span></ng-template>

    <p-dialog [(visible)]="dialogVisible" [header]="editando() ? 'Editar laboratorio' : 'Nuevo laboratorio'"
              [modal]="true" [style]="{ width: '32rem' }" [draggable]="false">
      <form [formGroup]="form" class="campos">
        <div class="campo span-4">
          <label for="nombre">Nombre</label>
          <input id="nombre" pInputText formControlName="nombre" maxlength="120" />
        </div>
        <div class="campo span-2">
          <label for="nit">NIT</label>
          <input id="nit" pInputText formControlName="nit" maxlength="20" />
        </div>
        <div class="campo span-6 check-campo">
          <p-checkbox formControlName="propio" [binary]="true" inputId="propio" />
          <label for="propio">Laboratorio propio de la empresa</label>
        </div>
        <div class="campo span-6 check-campo">
          <p-checkbox formControlName="acreditado" [binary]="true" inputId="acreditado" />
          <label for="acreditado">Acreditado (sirve como dirimente)</label>
        </div>
        <div class="campo span-6 check-campo" *ngIf="editando()">
          <p-checkbox formControlName="activo" [binary]="true" inputId="activo" />
          <label for="activo">Activo</label>
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="dialogVisible = false" />
        <p-button label="Guardar" icon="pi pi-check" [disabled]="form.invalid || guardando()"
                  [loading]="guardando()" (onClick)="guardar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CARGAS, `.pastilla + .pastilla { margin-left: 0.3rem; }`],
})
export class LaboratoriosComponent implements OnInit {
  private readonly servicio = inject(CatalogosCargasService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly laboratorios = signal<Laboratorio[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly editando = signal<Laboratorio | null>(null);
  dialogVisible = false;

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    nit: [''],
    propio: [false],
    acreditado: [false],
    activo: [true],
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listarLaboratorios().subscribe({
      next: (l) => { this.laboratorios.set(l); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  abrirNuevo(): void {
    this.editando.set(null);
    this.form.reset({ propio: false, acreditado: false, activo: true });
    this.dialogVisible = true;
  }

  abrirEdicion(l: Laboratorio): void {
    this.editando.set(l);
    this.form.reset(l as any);
    this.dialogVisible = true;
  }

  guardar(): void {
    this.guardando.set(true);
    this.servicio.guardarLaboratorio(this.form.getRawValue() as Partial<Laboratorio>, this.editando()?.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogVisible = false;
        this.toast.add({ severity: 'success', summary: 'Laboratorio guardado' });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo guardar', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }

  desactivar(l: Laboratorio): void {
    this.confirm.confirm({
      header: 'Desactivar laboratorio',
      message: `¿Desactivar «${l.nombre}»? Sus análisis anteriores se conservan.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      accept: () => this.servicio.desactivarLaboratorio(l.id).subscribe({
        next: () => { this.toast.add({ severity: 'info', summary: 'Laboratorio desactivado' }); this.cargar(); },
        error: (e) => this.toast.add({ severity: 'warn', summary: 'No se desactivó', detail: mensajeDeError(e) }),
      }),
    });
  }
}
