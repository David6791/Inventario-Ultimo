import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { Elemento, LineaElemento, LineaProducto, Opcion, Opciones } from '../core/models/cargas.model';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';

/**
 * Líneas de producto (qué se compra y cómo se paga) y los elementos que se
 * miden en cada una. Los elementos y su unidad de ley se administran en la
 * segunda pestaña.
 */
@Component({
  selector: 'app-lineas-elementos',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TableModule, TabViewModule, ButtonModule, DialogModule,
    DropdownModule, InputTextModule, InputNumberModule, CheckboxModule, TagModule, ToastModule,
    TooltipModule, TienePermisoDirective,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Líneas de producto y elementos</h2>
        <p class="subtitulo">
          La línea dice qué es el mineral y cómo se paga. Sus elementos PAGABLES son los
          que se le pagan al productor; el split limit es la diferencia máxima entre el
          ensaye de la empresa y el del productor antes de ir a dirimencia.
        </p>
      </div>
    </header>

    <p-tabView>
      <p-tabPanel header="Líneas de producto">
        <div class="acciones-tab" *appTienePermiso="'cargas.catalogos'">
          <p-button label="Nueva línea" icon="pi pi-plus" size="small" (onClick)="abrirLinea(null)" />
        </div>

        <p-table [value]="lineas()" [loading]="cargando()" dataKey="id" styleClass="p-datatable-sm tabla">
          <ng-template pTemplate="header">
            <tr>
              <th style="width: 11rem">Código</th>
              <th>Línea</th>
              <th style="width: 13rem">Cómo se paga</th>
              <th style="width: 18rem">Elementos</th>
              <th style="width: 6rem" class="derecha">Series</th>
              <th style="width: 4rem"></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-l>
            <tr [class.inactiva]="!l.activa">
              <td><span class="codigo">{{ l.codigo }}</span></td>
              <td>
                <div>{{ l.nombre }}</div>
                <div class="secundario">{{ l.forma | titlecase }}</div>
              </td>
              <td>{{ etiqueta(opciones()?.modalidades_precio, l.modalidad_precio) }}</td>
              <td>
                <span *ngFor="let e of l.elementos" class="pastilla"
                      [class.pastilla-acento]="e.rol === 'PAGABLE'" [class.pastilla-aviso]="e.rol === 'PENALIZABLE'"
                      [pTooltip]="e.rol + (e.split_limit ? ' · split limit ' + e.split_limit : '')">
                  {{ e.elemento?.codigo }}
                </span>
              </td>
              <td class="derecha contador">{{ l.series_count }}</td>
              <td class="centro">
                <p-button *appTienePermiso="'cargas.catalogos'" icon="pi pi-pencil" [text]="true"
                          [rounded]="true" size="small" (onClick)="abrirLinea(l)" />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-tabPanel>

      <p-tabPanel header="Elementos">
        <div class="nota nota-encabezado">
          <i class="pi pi-info-circle"></i>
          <span>
            Toda ley se guarda en la unidad de su elemento. Defina la unidad de la plata
            (decimarcos, g/TM u oz/TM) <strong>antes del primer análisis</strong>: con datos
            cargados ya no se puede cambiar.
          </span>
        </div>

        <div class="acciones-tab" *appTienePermiso="'cargas.catalogos'">
          <p-button label="Nuevo elemento" icon="pi pi-plus" size="small" (onClick)="abrirElemento(null)" />
        </div>

        <p-table [value]="elementos()" dataKey="id" styleClass="p-datatable-sm tabla">
          <ng-template pTemplate="header">
            <tr>
              <th style="width: 8rem">Código</th>
              <th>Elemento</th>
              <th style="width: 15rem">Unidad de ley</th>
              <th style="width: 13rem">Cotización por</th>
              <th style="width: 7rem" class="centro">Estado</th>
              <th style="width: 4rem"></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-e>
            <tr [class.inactiva]="!e.activo">
              <td><span class="codigo">{{ e.codigo }}</span></td>
              <td>{{ e.nombre }}</td>
              <td>
                {{ etiqueta(opciones()?.unidades_ley, e.unidad_ley) }}
                <i class="pi pi-lock candado" *ngIf="e.unidad_fija" pTooltip="Ya tiene datos: la unidad no cambia"></i>
              </td>
              <td>{{ e.unidad_cotizacion ? etiqueta(opciones()?.unidades_cotizacion, e.unidad_cotizacion) : '—' }}</td>
              <td class="centro">
                <p-tag [value]="e.activo ? 'Activo' : 'Inactivo'" [severity]="e.activo ? 'success' : 'secondary'" />
              </td>
              <td class="centro">
                <p-button *appTienePermiso="'cargas.catalogos'" icon="pi pi-pencil" [text]="true"
                          [rounded]="true" size="small" (onClick)="abrirElemento(e)" />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-tabPanel>
    </p-tabView>

    <!-- Línea -->
    <p-dialog [(visible)]="lineaVisible" [header]="lineaActual() ? 'Editar línea' : 'Nueva línea'"
              [modal]="true" [style]="{ width: '46rem' }" [draggable]="false">
      <form [formGroup]="formLinea" class="campos">
        <div class="campo span-2">
          <label for="l-codigo">Código</label>
          <input id="l-codigo" pInputText formControlName="codigo" maxlength="20" placeholder="CONC_ZN" />
        </div>
        <div class="campo span-4">
          <label for="l-nombre">Nombre</label>
          <input id="l-nombre" pInputText formControlName="nombre" maxlength="100" />
        </div>
        <div class="campo span-2">
          <label for="l-forma">Forma</label>
          <p-dropdown inputId="l-forma" formControlName="forma" [options]="opciones()?.formas ?? []"
                      optionLabel="etiqueta" optionValue="valor" appendTo="body" />
        </div>
        <div class="campo span-4">
          <label for="l-modalidad">Cómo se paga</label>
          <p-dropdown inputId="l-modalidad" formControlName="modalidad_precio" [options]="opciones()?.modalidades_precio ?? []"
                      optionLabel="etiqueta" optionValue="valor" appendTo="body" />
        </div>

        <div class="campo span-6">
          <label>Elementos</label>
          <div formArrayName="elementos" class="tabla-elementos">
            <div class="fila-elemento" *ngFor="let fila of filasElementos.controls; let i = index" [formGroupName]="i">
              <p-dropdown formControlName="elemento_id" [options]="elementosActivos()" optionLabel="etiqueta"
                          optionValue="id" placeholder="Elemento" [filter]="true" filterBy="etiqueta" appendTo="body" />
              <p-dropdown formControlName="rol" [options]="opciones()?.roles_elemento ?? []" optionLabel="etiqueta"
                          optionValue="valor" appendTo="body" />
              <p-inputNumber formControlName="split_limit" placeholder="Split limit" [minFractionDigits]="0"
                             [maxFractionDigits]="4" [min]="0" />
              <p-button icon="pi pi-trash" [text]="true" [rounded]="true" severity="danger" (onClick)="quitarElemento(i)" />
            </div>
          </div>
          <p-button label="Agregar elemento" icon="pi pi-plus" [text]="true" size="small" (onClick)="agregarElemento()" />
          <small *ngIf="!tienePagable()" class="error">La línea necesita al menos un elemento PAGABLE.</small>
        </div>

        <div class="campo span-6 check-campo" *ngIf="lineaActual()">
          <p-checkbox formControlName="activa" [binary]="true" inputId="l-activa" />
          <label for="l-activa">Activa</label>
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="lineaVisible = false" />
        <p-button label="Guardar" icon="pi pi-check" [disabled]="formLinea.invalid || !tienePagable() || guardando()"
                  [loading]="guardando()" (onClick)="guardarLinea()" />
      </ng-template>
    </p-dialog>

    <!-- Elemento -->
    <p-dialog [(visible)]="elementoVisible" [header]="elementoActual() ? 'Editar elemento' : 'Nuevo elemento'"
              [modal]="true" [style]="{ width: '32rem' }" [draggable]="false">
      <form [formGroup]="formElemento" class="campos">
        <div class="campo span-2">
          <label for="e-codigo">Código</label>
          <input id="e-codigo" pInputText formControlName="codigo" maxlength="10" placeholder="SIO2" />
        </div>
        <div class="campo span-4">
          <label for="e-nombre">Nombre</label>
          <input id="e-nombre" pInputText formControlName="nombre" maxlength="60" />
        </div>
        <div class="campo span-3">
          <label for="e-unidad">Unidad de ley</label>
          <p-dropdown inputId="e-unidad" formControlName="unidad_ley" [options]="opciones()?.unidades_ley ?? []"
                      optionLabel="etiqueta" optionValue="valor" appendTo="body" />
          <small *ngIf="elementoActual()?.unidad_fija">Ya tiene datos registrados: no cambia.</small>
        </div>
        <div class="campo span-3">
          <label for="e-cotizacion">Cotización por</label>
          <p-dropdown inputId="e-cotizacion" formControlName="unidad_cotizacion"
                      [options]="opciones()?.unidades_cotizacion ?? []" optionLabel="etiqueta" optionValue="valor"
                      [showClear]="true" placeholder="No cotiza" appendTo="body" />
        </div>
        <div class="campo span-6 check-campo" *ngIf="elementoActual()">
          <p-checkbox formControlName="activo" [binary]="true" inputId="e-activo" />
          <label for="e-activo">Activo</label>
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="elementoVisible = false" />
        <p-button label="Guardar" icon="pi pi-check" [disabled]="formElemento.invalid || guardando()"
                  [loading]="guardando()" (onClick)="guardarElemento()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CARGAS, `
    .acciones-tab { display: flex; justify-content: flex-end; margin-bottom: 0.75rem; }
    .pastilla { margin: 0 0.25rem 0.2rem 0; }
    .candado { margin-left: 0.35rem; font-size: 0.75rem; color: var(--text-color-secondary, #9ca3af); }
    .tabla-elementos { display: flex; flex-direction: column; gap: 0.5rem; }
    .fila-elemento { display: grid; grid-template-columns: 2fr 1.4fr 1.2fr auto; gap: 0.5rem; align-items: center; }
    .fila-elemento :is(.p-dropdown, .p-inputnumber) { width: 100%; }
    .error { color: #b91c1c; }
  `],
})
export class LineasElementosComponent implements OnInit {
  private readonly servicio = inject(CatalogosCargasService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);

  readonly lineas = signal<LineaProducto[]>([]);
  readonly elementos = signal<Elemento[]>([]);
  readonly opciones = signal<Opciones | null>(null);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly lineaActual = signal<LineaProducto | null>(null);
  readonly elementoActual = signal<Elemento | null>(null);

  readonly elementosActivos = computed(() =>
    this.elementos()
      .filter((e) => e.activo && e.codigo !== 'H2O')
      .map((e) => ({ ...e, etiqueta: `${e.codigo} · ${e.nombre}` })));

  lineaVisible = false;
  elementoVisible = false;

  readonly formLinea = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(20)]],
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    forma: ['CARGA', Validators.required],
    modalidad_precio: ['POR_PUNTO', Validators.required],
    activa: [true],
    elementos: this.fb.array<FormGroup>([]),
  });

  readonly formElemento = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(10)]],
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    unidad_ley: ['%', Validators.required],
    unidad_cotizacion: [null as string | null],
    activo: [true],
  });

  get filasElementos(): FormArray<FormGroup> {
    return this.formLinea.get('elementos') as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    this.servicio.opciones$.subscribe((o) => this.opciones.set(o));
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listarLineas().subscribe({
      next: (l) => { this.lineas.set(l); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
    this.servicio.listarElementos().subscribe((e) => this.elementos.set(e));
  }

  etiqueta(lista: Opcion[] | undefined, valor: string): string {
    return lista?.find((o) => o.valor === valor)?.etiqueta ?? valor;
  }

  // ---------------------------------------------------------------- Líneas

  tienePagable(): boolean {
    return this.filasElementos.controls.some((c) => c.value.rol === 'PAGABLE');
  }

  private filaElemento(e?: Partial<LineaElemento>): FormGroup {
    return this.fb.group({
      elemento_id: [e?.elemento_id ?? null, Validators.required],
      rol: [e?.rol ?? 'PAGABLE', Validators.required],
      split_limit: [e?.split_limit ?? null],
    });
  }

  agregarElemento(): void {
    this.filasElementos.push(this.filaElemento({ rol: this.tienePagable() ? 'PENALIZABLE' : 'PAGABLE' }));
  }

  quitarElemento(i: number): void {
    this.filasElementos.removeAt(i);
  }

  abrirLinea(l: LineaProducto | null): void {
    this.lineaActual.set(l);
    this.filasElementos.clear();
    this.formLinea.reset(l ? { ...l } as any : { forma: 'CARGA', modalidad_precio: 'POR_PUNTO', activa: true });
    (l?.elementos ?? []).forEach((e) => this.filasElementos.push(this.filaElemento(e)));
    if (!l) this.agregarElemento();
    this.lineaVisible = true;
  }

  guardarLinea(): void {
    this.guardando.set(true);
    this.servicio.guardarLinea(this.formLinea.getRawValue() as Partial<LineaProducto>, this.lineaActual()?.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.lineaVisible = false;
        this.toast.add({ severity: 'success', summary: 'Línea guardada' });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo guardar', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }

  // ------------------------------------------------------------- Elementos

  abrirElemento(e: Elemento | null): void {
    this.elementoActual.set(e);
    this.formElemento.reset(e ? { ...e } as any : { unidad_ley: '%', activo: true });

    const codigo = this.formElemento.get('codigo')!;
    const unidad = this.formElemento.get('unidad_ley')!;
    e ? codigo.disable() : codigo.enable();          // el código no cambia nunca
    e?.unidad_fija ? unidad.disable() : unidad.enable();

    this.elementoVisible = true;
  }

  guardarElemento(): void {
    this.guardando.set(true);
    const actual = this.elementoActual();
    const datos = actual ? this.formElemento.value : this.formElemento.getRawValue();
    if (actual) {
      // Los campos deshabilitados no viajan; la unidad fija se reenvía tal cual.
      (datos as any).unidad_ley = actual.unidad_fija ? actual.unidad_ley : this.formElemento.get('unidad_ley')!.value;
    }

    this.servicio.guardarElemento(datos as Partial<Elemento>, actual?.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.elementoVisible = false;
        this.toast.add({ severity: 'success', summary: 'Elemento guardado' });
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo guardar', detail: mensajeDeError(err), life: 8000 });
      },
    });
  }
}
