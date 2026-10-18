import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { mensajeDeError } from '../../cargas/core/errores';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { Concepto } from '../core/caja.model';
import { CajaService } from '../core/caja.service';
import { ESTILOS_CAJA } from '../core/estilos';

/**
 * Conceptos de ingreso y egreso. Los manuales los administra quien maneja las
 * cajas; los que genera cargas (anticipos, bonos) se muestran para que se sepa
 * que existen, pero solo ese módulo los usa.
 */
@Component({
  selector: 'app-conceptos-caja',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule, InputTextModule,
    CheckboxModule, SelectButtonModule, ToastModule, TooltipModule, TienePermisoDirective,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Conceptos de caja</h2>
        <p class="subtitulo">
          El concepto dice si el movimiento es ingreso o egreso y agrupa el libro de caja.
          Los que genera cargas solo se usan al pagar anticipos y bonos.
        </p>
      </div>
      <div class="acciones" *appTienePermiso="'caja.administrar'">
        <p-button label="Nuevo concepto" icon="pi pi-plus" (onClick)="abrir(null)" />
      </div>
    </header>

    <div class="barra">
      <p-selectButton [options]="filtros" [(ngModel)]="filtro" optionLabel="etiqueta" optionValue="valor" />
    </div>

    <p-table [value]="visibles()" [loading]="cargando()" dataKey="id" styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th>Concepto</th>
          <th style="width: 8rem">Tipo</th>
          <th style="width: 13rem">Lo usa</th>
          <th style="width: 8rem" class="derecha">Movimientos</th>
          <th style="width: 4rem"></th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-c>
        <tr [class.inactiva]="!c.activo">
          <td>
            <div>{{ c.nombre }}</div>
            <div class="secundario codigo">{{ c.codigo }}</div>
          </td>
          <td>
            <span class="pastilla" [class.pastilla-ingreso]="c.tipo === 'INGRESO'" [class.pastilla-egreso]="c.tipo === 'EGRESO'">
              {{ c.tipo === 'INGRESO' ? 'Ingreso' : 'Egreso' }}
            </span>
          </td>
          <td>
            <span *ngIf="c.origen === 'MANUAL'" class="secundario">El cajero, a mano</span>
            <span *ngIf="c.origen !== 'MANUAL'" class="pastilla pastilla-acento" pTooltip="Lo registra el módulo de cargas, vinculado a su documento">
              Cargas · automático
            </span>
            <span *ngIf="!c.activo" class="pastilla">Inactivo</span>
          </td>
          <td class="derecha contador">{{ c.movimientos }}</td>
          <td class="centro">
            <ng-container *ngIf="c.origen === 'MANUAL'">
              <p-button *appTienePermiso="'caja.administrar'" icon="pi pi-pencil" [text]="true" [rounded]="true"
                        size="small" pTooltip="Editar" (onClick)="abrir(c)" />
            </ng-container>
            <i *ngIf="c.origen !== 'MANUAL'" class="pi pi-lock candado" pTooltip="No se edita desde caja"></i>
          </td>
        </tr>
      </ng-template>
    </p-table>

    <p-dialog [(visible)]="editorVisible" [header]="actual() ? 'Editar concepto' : 'Nuevo concepto'"
              [modal]="true" [style]="{ width: '34rem' }" [draggable]="false">
      <div class="nota nota-aviso nota-encabezado" *ngIf="actual()?.movimientos">
        <i class="pi pi-lock"></i>
        <span>Ya tiene {{ actual()!.movimientos }} movimiento(s): el tipo queda fijo. Si necesita el otro tipo, cree otro concepto.</span>
      </div>

      <form [formGroup]="form" class="campos">
        <div class="campo span-6">
          <label for="nombre">Nombre</label>
          <input id="nombre" pInputText formControlName="nombre" maxlength="120" placeholder="Pago de sueldos"
                 (blur)="sugerirCodigo()" />
        </div>
        <div class="campo span-3">
          <label for="codigo">Código</label>
          <input id="codigo" pInputText formControlName="codigo" maxlength="40" class="codigo" placeholder="PAGO_SUELDOS" />
          <small>Para los reportes. Mayúsculas y guion bajo.</small>
        </div>
        <div class="campo span-3">
          <label>Tipo</label>
          <p-selectButton formControlName="tipo" [options]="tipos" optionLabel="etiqueta" optionValue="valor" />
        </div>
        <div class="campo span-6 check-campo">
          <p-checkbox formControlName="activo" [binary]="true" inputId="activo" />
          <label for="activo">Activo (el cajero lo puede elegir)</label>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="editorVisible = false" />
        <p-button label="Guardar" icon="pi pi-check" [loading]="guardando()" [disabled]="form.invalid || guardando()"
                  (onClick)="guardar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CAJA, `
    .candado { color: var(--text-color-secondary, #9ca3af); font-size: 0.85rem; }
  `],
})
export class ConceptosCajaComponent implements OnInit {
  private readonly servicio = inject(CajaService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);

  readonly conceptos = signal<Concepto[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly actual = signal<Concepto | null>(null);
  readonly filtroActual = signal<'TODOS' | 'INGRESO' | 'EGRESO'>('TODOS');

  readonly filtros = [
    { valor: 'TODOS', etiqueta: 'Todos' },
    { valor: 'INGRESO', etiqueta: 'Ingresos' },
    { valor: 'EGRESO', etiqueta: 'Egresos' },
  ];
  readonly tipos = [
    { valor: 'INGRESO', etiqueta: 'Ingreso' },
    { valor: 'EGRESO', etiqueta: 'Egreso' },
  ];

  get filtro(): 'TODOS' | 'INGRESO' | 'EGRESO' { return this.filtroActual(); }
  set filtro(v: 'TODOS' | 'INGRESO' | 'EGRESO') { this.filtroActual.set(v ?? 'TODOS'); }

  readonly visibles = computed(() => {
    const f = this.filtroActual();
    return f === 'TODOS' ? this.conceptos() : this.conceptos().filter((c) => c.tipo === f);
  });

  editorVisible = false;

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    codigo: ['', [Validators.required, Validators.maxLength(40)]],
    tipo: ['EGRESO', Validators.required],
    activo: [true],
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.conceptos().subscribe({
      next: (c) => { this.conceptos.set(c); this.cargando.set(false); },
      error: (e) => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo cargar la lista', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }

  abrir(c: Concepto | null): void {
    this.actual.set(c);
    this.form.reset(c ? { ...c } : { tipo: 'EGRESO', activo: true });
    c?.movimientos ? this.form.get('tipo')!.disable() : this.form.get('tipo')!.enable();
    this.editorVisible = true;
  }

  /** Si el código está vacío, lo arma con el nombre: «Pago de sueldos» → PAGO_DE_SUELDOS. */
  sugerirCodigo(): void {
    const codigo = this.form.get('codigo')!;
    if (codigo.value || this.actual()) return;
    const nombre = (this.form.get('nombre')!.value ?? '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
    codigo.setValue(nombre);
  }

  guardar(): void {
    this.guardando.set(true);
    this.servicio.guardarConcepto(this.form.getRawValue() as Partial<Concepto>, this.actual()?.id).subscribe({
      next: (c) => {
        this.guardando.set(false);
        this.editorVisible = false;
        this.toast.add({ severity: 'success', summary: 'Concepto guardado', detail: c.nombre });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo guardar', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }
}
