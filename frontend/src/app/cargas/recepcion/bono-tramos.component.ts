import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { hoy } from '../../caja/core/archivos';
import { formatoDinero } from '../../caja/core/dinero';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { TablaTramos } from '../core/models/cargas.model';
import { RecepcionService } from '../core/services/recepcion.service';

interface FilaTramo { tipo_vehiculo: string; peso_desde_kg: number | null; peso_hasta_kg: number | null; monto: number | null; }

/**
 * Tabla del bono de transporte por peso neto. Una tabla nueva se publica con
 * fecha de vigencia (hoy o posterior): la vigente se cierra ese día y los bonos
 * ya generados conservan el tramo con que se calcularon.
 */
@Component({
  selector: 'app-bono-tramos',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputNumberModule, InputTextModule, TableModule, ToastModule,
            TienePermisoDirective],
  providers: [MessageService],
  template: `
    <p-toast />
    <header class="encabezado">
      <div>
        <h2>Bono de transporte</h2>
        <p class="subtitulo">Lo que la caja paga al chofer según el peso neto del pesaje de ingreso.</p>
      </div>
      <div class="acciones" *appTienePermiso="'cargas.configurar-bono'">
        <p-button label="Nueva tabla" icon="pi pi-plus" (onClick)="nueva()" />
      </div>
    </header>

    <div class="vacio" *ngIf="!cargando() && !tablas().length">
      <i class="pi pi-money-bill"></i><div class="titulo-vacio">Todavía no hay tabla de bono</div>
      <span>Sin tabla vigente, los pesajes se registran sin bono.</span>
    </div>

    <section class="tabla-bono" *ngFor="let t of tablas()" [class.anterior]="t.estado === 'ANTERIOR'">
      <h3>
        <span class="pastilla" [class.pastilla-acento]="t.estado === 'VIGENTE'" [class.pastilla-aviso]="t.estado === 'PROXIMA'">
          {{ t.estado === 'VIGENTE' ? 'Vigente' : t.estado === 'PROXIMA' ? 'Próxima' : 'Anterior' }}</span>
        Desde {{ t.vigente_desde | date: 'dd/MM/yyyy' }}{{ t.vigente_hasta ? ' hasta ' + (t.vigente_hasta | date: 'dd/MM/yyyy') : '' }}
      </h3>
      <p-table [value]="t.tramos" styleClass="p-datatable-sm tabla">
        <ng-template pTemplate="header">
          <tr><th>Vehículo</th><th class="derecha" style="width: 10rem">Desde kg</th><th class="derecha" style="width: 10rem">Hasta kg</th>
              <th class="derecha" style="width: 9rem">Bono</th></tr>
        </ng-template>
        <ng-template pTemplate="body" let-r>
          <tr><td>{{ r.tipo_vehiculo }}</td><td class="derecha monto">{{ kg(r.peso_desde_kg) }}</td>
              <td class="derecha monto">{{ r.peso_hasta_kg === null ? 'en adelante' : kg(r.peso_hasta_kg) }}</td>
              <td class="derecha monto">{{ r.moneda ?? 'BOB' }} {{ kg(r.monto) }}</td></tr>
        </ng-template>
      </p-table>
    </section>

    <p-dialog [(visible)]="editorVisible" header="Nueva tabla de bono" [modal]="true" [style]="{ width: '48rem' }" [draggable]="false">
      <p class="explicacion">Cada tramo cubre desde su peso (inclusive) hasta el siguiente (sin incluirlo). Deje «hasta» vacío en el último.
        La tabla vigente se cierra el día que esta empieza.</p>
      <div class="campo fecha">
        <label for="desde">Vigente desde</label>
        <input id="desde" pInputText type="date" [(ngModel)]="desde" [min]="minimo" />
      </div>
      <table class="editor">
        <thead><tr><th>Vehículo</th><th>Desde kg</th><th>Hasta kg</th><th>Bono Bs</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let f of filas; let i = index">
            <td><input pInputText [(ngModel)]="f.tipo_vehiculo" maxlength="30" placeholder="Camión" /></td>
            <td><p-inputNumber [(ngModel)]="f.peso_desde_kg" [min]="0" [maxFractionDigits]="2" locale="es-BO" /></td>
            <td><p-inputNumber [(ngModel)]="f.peso_hasta_kg" [min]="0" [maxFractionDigits]="2" locale="es-BO" placeholder="en adelante" /></td>
            <td><p-inputNumber [(ngModel)]="f.monto" [min]="0" [minFractionDigits]="2" [maxFractionDigits]="2" locale="es-BO" /></td>
            <td><p-button icon="pi pi-trash" [text]="true" [rounded]="true" severity="danger" [disabled]="filas.length === 1"
                          (onClick)="filas.splice(i, 1)" /></td>
          </tr>
        </tbody>
      </table>
      <p-button label="Agregar tramo" icon="pi pi-plus" [text]="true" size="small" (onClick)="agregar()" />
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="editorVisible = false" />
        <p-button label="Publicar" icon="pi pi-check" [loading]="guardando()" [disabled]="!valida() || guardando()" (onClick)="publicar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CARGAS, `
    .tabla-bono { margin-bottom: 1.4rem; }
    .tabla-bono h3 { font-size: 0.95rem; display: flex; align-items: center; gap: 0.6rem; margin: 0 0 0.5rem; }
    .tabla-bono.anterior { opacity: 0.65; }
    .monto { font-family: ui-monospace, 'SF Mono', Menlo, monospace; white-space: nowrap; }
    .explicacion { font-size: 0.88rem; line-height: 1.5; margin-top: 0; }
    .campo.fecha { display: flex; flex-direction: column; gap: 0.3rem; max-width: 12rem; margin-bottom: 0.8rem; }
    .editor { width: 100%; border-collapse: collapse; }
    .editor th { text-align: left; font-size: 0.72rem; text-transform: uppercase; color: var(--text-color-secondary, #6b7280); padding: 0.2rem; }
    .editor td { padding: 0.2rem; }
    .editor input, .editor :host ::ng-deep .p-inputnumber { width: 100%; }
    :host ::ng-deep .editor .p-inputnumber-input { width: 100%; }
  `],
})
export class BonoTramosComponent implements OnInit {
  private readonly servicio = inject(RecepcionService);
  private readonly toast = inject(MessageService);

  readonly tablas = signal<TablaTramos[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);

  editorVisible = false;
  desde = hoy();
  readonly minimo = hoy();
  filas: FilaTramo[] = [];

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.servicio.tramos().subscribe({
      next: (t) => { this.tablas.set(t); this.cargando.set(false); },
      error: (e) => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo cargar la tabla', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }

  kg(v: string | number): string { return formatoDinero(v); }

  /** Parte de la tabla más reciente para editar solo lo que cambia. */
  nueva(): void {
    const base = this.tablas().find((t) => t.estado === 'PROXIMA') ?? this.tablas().find((t) => t.estado === 'VIGENTE');
    this.filas = base
      ? base.tramos.map((t) => ({ tipo_vehiculo: t.tipo_vehiculo, peso_desde_kg: +t.peso_desde_kg,
                                  peso_hasta_kg: t.peso_hasta_kg === null ? null : +t.peso_hasta_kg, monto: +t.monto }))
      : [{ tipo_vehiculo: '', peso_desde_kg: 0, peso_hasta_kg: null, monto: null }];
    this.desde = hoy();
    this.editorVisible = true;
  }

  agregar(): void {
    const ultima = this.filas[this.filas.length - 1];
    this.filas.push({ tipo_vehiculo: '', peso_desde_kg: ultima?.peso_hasta_kg ?? null, peso_hasta_kg: null, monto: null });
  }

  valida(): boolean {
    return !!this.desde && this.desde >= this.minimo && this.filas.every((f) =>
      f.tipo_vehiculo.trim() && f.peso_desde_kg !== null && f.monto !== null &&
      (f.peso_hasta_kg === null || f.peso_hasta_kg > f.peso_desde_kg));
  }

  publicar(): void {
    this.guardando.set(true);
    const tramos = this.filas.map((f) => ({ ...f, tipo_vehiculo: f.tipo_vehiculo.trim(), peso_desde_kg: f.peso_desde_kg!, monto: f.monto! }));
    this.servicio.publicarTramos(this.desde, tramos).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.editorVisible = false;
        this.toast.add({ severity: 'success', summary: r.mensaje, life: 7000 });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se publicó la tabla', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }
}
