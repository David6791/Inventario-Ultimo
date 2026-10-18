import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { Cooperativa, Opcion, Productor } from '../core/models/cargas.model';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';

/**
 * Productores: quien entrega mineral (el «cliente» del sistema anterior).
 * La lista crece con cada recepción, por eso se pagina y se busca en el
 * servidor por nombre, CI, NIT o NIM.
 */
@Component({
  selector: 'app-productores',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink, TableModule, ButtonModule,
    DialogModule, DropdownModule, InputTextModule, CheckboxModule, TagModule, ToastModule,
    ConfirmDialogModule, TooltipModule, TienePermisoDirective,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <header class="encabezado">
      <div>
        <h2>Productores</h2>
        <p class="subtitulo">
          Quienes entregan mineral: cooperativistas, particulares, empresas e ingenios.
          El lote toma la cooperativa del productor al momento de recibir.
        </p>
      </div>
      <div class="acciones" *appTienePermiso="'cargas.catalogos'">
        <p-button label="Importar" icon="pi pi-file-excel" [outlined]="true"
                  routerLink="/cargas/productores/importar"
                  pTooltip="Cargar productores desde una planilla de Excel" />
        <p-button label="Nuevo productor" icon="pi pi-plus" (onClick)="abrirNuevo()" />
      </div>
    </header>

    <div class="barra">
      <span class="campo-busqueda">
        <i class="pi pi-search"></i>
        <input pInputText placeholder="Nombre, CI, NIT o NIM…" [(ngModel)]="texto"
               (ngModelChange)="busqueda$.next($event)" />
      </span>
      <div class="filtro">
        <p-dropdown [options]="tipos()" [(ngModel)]="filtroTipo" optionLabel="etiqueta"
                    optionValue="valor" placeholder="Todos los tipos" [showClear]="true"
                    (onChange)="recargar()" />
      </div>
      <div class="filtro">
        <p-dropdown [options]="cooperativas()" [(ngModel)]="filtroCooperativa" optionLabel="nombre"
                    optionValue="id" placeholder="Todas las cooperativas" [showClear]="true"
                    [filter]="true" filterBy="nombre" (onChange)="recargar()" />
      </div>
    </div>

    <p-table [value]="productores()" [loading]="cargando()" [lazy]="true" [paginator]="true"
             [rows]="porPagina" [totalRecords]="total()" (onLazyLoad)="cargar($event)"
             [first]="primero" dataKey="id" styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th>Productor</th>
          <th style="width: 10rem">Documento</th>
          <th style="width: 9rem">NIM</th>
          <th style="width: 16rem">Cooperativa</th>
          <th style="width: 7rem" class="centro">Estado</th>
          <th style="width: 6rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-p>
        <tr [class.inactiva]="!p.activo">
          <td>
            <div>{{ p.nombre }}</div>
            <div class="secundario">{{ etiquetaTipo(p.tipo) }}<span *ngIf="p.telefono"> · {{ p.telefono }}</span></div>
          </td>
          <td>
            <div *ngIf="p.ci" class="codigo">CI {{ p.ci }}</div>
            <div *ngIf="p.nit" class="codigo">NIT {{ p.nit }}</div>
          </td>
          <td><span class="codigo" *ngIf="p.nim; else guion">{{ p.nim }}</span></td>
          <td>{{ p.cooperativa?.nombre ?? '' }}<span class="guion" *ngIf="!p.cooperativa">—</span></td>
          <td class="centro">
            <p-tag [value]="p.activo ? 'Activo' : 'Inactivo'" [severity]="p.activo ? 'success' : 'secondary'" />
          </td>
          <td class="centro">
            <ng-container *appTienePermiso="'cargas.catalogos'">
              <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" size="small" (onClick)="abrirEdicion(p)" />
              <p-button icon="pi pi-ban" [text]="true" [rounded]="true" size="small" severity="danger"
                        [disabled]="!p.activo" (onClick)="confirmarDesactivar(p)" />
            </ng-container>
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="6">
          <div class="vacio">
            <i class="pi pi-users"></i>
            <p class="titulo-vacio">
              {{ texto || filtroTipo || filtroCooperativa ? 'Ningún productor coincide con la búsqueda' : 'Sin productores registrados' }}
            </p>
          </div>
        </td></tr>
      </ng-template>
    </p-table>

    <ng-template #guion><span class="guion">—</span></ng-template>

    <p-dialog [(visible)]="dialogVisible" [header]="editando() ? 'Editar productor' : 'Nuevo productor'"
              [modal]="true" [style]="{ width: '40rem' }" [draggable]="false">
      <form [formGroup]="form" class="campos">
        <div class="campo span-3">
          <label for="tipo">Tipo</label>
          <p-dropdown inputId="tipo" formControlName="tipo" [options]="tipos()" optionLabel="etiqueta"
                      optionValue="valor" appendTo="body" (onChange)="alCambiarTipo()" />
        </div>

        <div class="campo span-3">
          <label for="cooperativa">Cooperativa</label>
          <p-dropdown inputId="cooperativa" formControlName="cooperativa_id" [options]="cooperativasActivas()"
                      optionLabel="nombre" optionValue="id" [filter]="true" filterBy="nombre"
                      [placeholder]="esCooperativista() ? 'Seleccione' : 'No corresponde'" appendTo="body" />
        </div>

        <div class="campo span-6">
          <label for="nombre">Nombre completo o razón social</label>
          <input id="nombre" pInputText formControlName="nombre" maxlength="150" />
        </div>

        <div class="campo span-2">
          <label for="ci">CI</label>
          <input id="ci" pInputText formControlName="ci" maxlength="15" placeholder="1234567 PT" />
        </div>
        <div class="campo span-2">
          <label for="nit">NIT</label>
          <input id="nit" pInputText formControlName="nit" maxlength="20" />
        </div>
        <div class="campo span-2">
          <label for="nim">NIM</label>
          <input id="nim" pInputText formControlName="nim" maxlength="30" />
        </div>
        <div class="campo span-6" *ngIf="form.errors?.['documento'] && (form.touched || form.dirty)">
          <small class="error">Indique el CI o el NIT.</small>
        </div>

        <div class="campo span-2">
          <label for="telefono">Teléfono</label>
          <input id="telefono" pInputText formControlName="telefono" maxlength="20" />
        </div>
        <div class="campo span-4">
          <label for="domicilio">Domicilio</label>
          <input id="domicilio" pInputText formControlName="domicilio" maxlength="200" />
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
  styles: [ESTILOS_CARGAS, `.error { color: #b91c1c; }`],
})
export class ProductoresComponent implements OnInit {
  private readonly servicio = inject(CatalogosCargasService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly productores = signal<Productor[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly editando = signal<Productor | null>(null);
  readonly tipos = signal<Opcion[]>([]);
  readonly cooperativas = signal<Cooperativa[]>([]);
  readonly cooperativasActivas = signal<Cooperativa[]>([]);
  readonly esCooperativista = signal(true);

  readonly busqueda$ = new Subject<string>();
  readonly porPagina = 25;
  primero = 0;
  texto = '';
  filtroTipo: string | null = null;
  filtroCooperativa: number | null = null;
  dialogVisible = false;

  readonly form = this.fb.group({
    tipo: ['COOPERATIVISTA', Validators.required],
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    ci: [''],
    nit: [''],
    nim: [''],
    telefono: [''],
    domicilio: [''],
    cooperativa_id: [null as number | null, Validators.required],
    activo: [true],
  }, {
    validators: (g) => (g.get('ci')?.value || g.get('nit')?.value) ? null : { documento: true },
  });

  ngOnInit(): void {
    this.servicio.opciones$.subscribe((o) => this.tipos.set(o.tipos_productor));
    this.servicio.listarCooperativas().subscribe((c) => {
      this.cooperativas.set(c);
      this.cooperativasActivas.set(c.filter((x) => x.activa));
    });

    // Espera a que el usuario deje de escribir antes de ir al servidor.
    this.busqueda$.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => this.recargar());
  }

  cargar(evento?: TableLazyLoadEvent): void {
    this.primero = evento?.first ?? this.primero;
    this.cargando.set(true);
    this.servicio.listarProductores({
      buscar: this.texto.trim(),
      tipo: this.filtroTipo,
      cooperativa_id: this.filtroCooperativa,
      pagina: Math.floor(this.primero / this.porPagina) + 1,
      por_pagina: this.porPagina,
    }).subscribe({
      next: (p) => { this.productores.set(p.data); this.total.set(p.total); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  recargar(): void {
    this.primero = 0;
    this.cargar();
  }

  etiquetaTipo(tipo: string): string {
    return this.tipos().find((t) => t.valor === tipo)?.etiqueta ?? tipo;
  }

  alCambiarTipo(): void {
    const coop = this.form.get('cooperativa_id')!;
    this.esCooperativista.set(this.form.value.tipo === 'COOPERATIVISTA');

    if (this.esCooperativista()) {
      coop.enable();
      coop.setValidators(Validators.required);
    } else {
      coop.setValue(null);
      coop.clearValidators();
      coop.disable();
    }
    coop.updateValueAndValidity();
  }

  abrirNuevo(): void {
    this.editando.set(null);
    this.form.reset({ tipo: 'COOPERATIVISTA', activo: true });
    this.alCambiarTipo();
    this.dialogVisible = true;
  }

  abrirEdicion(p: Productor): void {
    this.editando.set(p);
    this.form.reset(p as any);
    this.alCambiarTipo();
    this.dialogVisible = true;
  }

  guardar(): void {
    this.guardando.set(true);
    const actual = this.editando();

    this.servicio.guardarProductor(this.form.getRawValue() as Partial<Productor>, actual?.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogVisible = false;
        this.toast.add({ severity: 'success', summary: 'Productor guardado' });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo guardar', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }

  confirmarDesactivar(p: Productor): void {
    this.confirm.confirm({
      header: 'Desactivar productor',
      message: `¿Desactivar a «${p.nombre}»? No se borra: sus lotes y anticipos se conservan.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      accept: () => this.servicio.desactivarProductor(p.id).subscribe({
        next: () => { this.toast.add({ severity: 'info', summary: 'Productor desactivado' }); this.cargar(); },
        error: (e) => this.toast.add({ severity: 'warn', summary: 'No se desactivó', detail: mensajeDeError(e) }),
      }),
    });
  }
}
