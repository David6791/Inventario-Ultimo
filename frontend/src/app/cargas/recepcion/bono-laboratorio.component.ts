import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { hoy } from '../../caja/core/archivos';
import { formatoDinero } from '../../caja/core/dinero';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { TablaLaboratorio } from '../core/models/cargas.model';
import { RecepcionService } from '../core/services/recepcion.service';

const EJEMPLOS: Record<number, string> = { 1: 'ZN · AG · PB', 2: 'ZN-AG · ZN-PB · PB-AG', 3: 'ZN-AG-PB' };

/**
 * Tabla del bono de laboratorio: un monto por lote según cuántos elementos
 * trae el material. Se paga en caja al productor (o a quien venga a cobrar)
 * y la liquidación lo descuenta como anticipo.
 */
@Component({
  selector: 'app-bono-laboratorio',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputNumberModule, InputTextModule, ToastModule, TienePermisoDirective],
  providers: [MessageService],
  template: `
    <p-toast />
    <header class="encabezado">
      <div>
        <h2>Bono de laboratorio</h2>
        <p class="subtitulo">Lo que la caja adelanta por lote para los ensayos, según los elementos del material. Se descuenta en la liquidación.</p>
      </div>
      <div class="acciones" *appTienePermiso="'cargas.configurar-bono'">
        <p-button label="Nueva tabla" icon="pi pi-plus" (onClick)="nueva()" />
      </div>
    </header>

    <div class="vacio" *ngIf="!cargando() && !tablas().length">
      <i class="pi pi-filter-fill"></i><div class="titulo-vacio">Todavía no hay tabla de bono de laboratorio</div>
      <span>Sin tabla vigente, los lotes se reciben sin bono de laboratorio.</span>
    </div>

    <section class="tabla-bono" *ngFor="let t of tablas()" [class.anterior]="t.estado === 'ANTERIOR'">
      <h3>
        <span class="pastilla" [class.pastilla-acento]="t.estado === 'VIGENTE'" [class.pastilla-aviso]="t.estado === 'PROXIMA'">
          {{ t.estado === 'VIGENTE' ? 'Vigente' : t.estado === 'PROXIMA' ? 'Próxima' : 'Anterior' }}</span>
        Desde {{ t.vigente_desde | date: 'dd/MM/yyyy' }}{{ t.vigente_hasta ? ' hasta ' + (t.vigente_hasta | date: 'dd/MM/yyyy') : '' }}
      </h3>
      <table class="tabla-lab">
        <thead><tr><th style="width: 9rem">Elementos</th><th>Por ejemplo</th><th class="derecha" style="width: 10rem">Bono</th></tr></thead>
        <tbody>
          <tr *ngFor="let r of t.tramos">
            <td>{{ r.num_elementos }} elemento{{ r.num_elementos === 1 ? '' : 's' }}</td>
            <td class="codigo secundario">{{ ejemplo(r.num_elementos) }}</td>
            <td class="derecha codigo">{{ r.moneda ?? 'BOB' }} {{ fmt(r.monto) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <p-dialog [(visible)]="editorVisible" header="Nueva tabla del bono de laboratorio" [modal]="true" [style]="{ width: '34rem', maxWidth: '96vw' }" [draggable]="false">
      <p class="explicacion">Un monto por cantidad de elementos del material del lote. La tabla vigente se cierra el día que esta empieza.</p>
      <div class="campo fecha">
        <label for="desde-lab">Vigente desde</label>
        <input id="desde-lab" pInputText type="date" [(ngModel)]="desde" [min]="minimo" />
      </div>
      <table class="tabla-lab editor">
        <thead><tr><th>Elementos</th><th>Por ejemplo</th><th>Bono Bs</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let f of filas; let i = index">
            <td><p-inputNumber [(ngModel)]="f.num_elementos" [min]="1" [max]="9" [showButtons]="true" inputStyleClass="corto" /></td>
            <td class="codigo secundario">{{ ejemplo(f.num_elementos) }}</td>
            <td><p-inputNumber [(ngModel)]="f.monto" [min]="0" [minFractionDigits]="2" [maxFractionDigits]="2" locale="es-BO" /></td>
            <td><p-button icon="pi pi-trash" [text]="true" [rounded]="true" severity="danger" [disabled]="filas.length === 1" (onClick)="filas.splice(i, 1)" /></td>
          </tr>
        </tbody>
      </table>
      <p-button label="Agregar fila" icon="pi pi-plus" [text]="true" size="small" (onClick)="agregar()" />
      <small class="error" *ngIf="repetidas()">Cada cantidad de elementos va una sola vez.</small>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="editorVisible = false" />
        <p-button label="Publicar" icon="pi pi-check" [loading]="guardando()" [disabled]="!valida() || guardando()" (onClick)="publicar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CARGAS, `
    .tabla-bono { margin-bottom: 1.4rem; max-width: 40rem; }
    .tabla-bono h3 { font-size: 0.95rem; display: flex; align-items: center; gap: 0.6rem; margin: 0 0 0.5rem; }
    .tabla-bono.anterior { opacity: 0.6; }
    table.tabla-lab { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    table.tabla-lab th { text-align: left; font-size: 0.7rem; text-transform: uppercase; color: var(--text-color-secondary, #6b7280);
                         padding: 0.35rem 0.4rem; border-bottom: 1px solid var(--surface-border, #e5e7eb); }
    table.tabla-lab td { padding: 0.45rem 0.4rem; border-bottom: 1px solid var(--surface-border, #f1f5f9); }
    table.editor td { padding: 0.25rem; border: 0; }
    :host ::ng-deep .corto { width: 4rem; }
    .explicacion { font-size: 0.88rem; line-height: 1.5; margin-top: 0; }
    .campo.fecha { display: flex; flex-direction: column; gap: 0.3rem; max-width: 12rem; margin-bottom: 0.8rem; }
    .derecha { text-align: right !important; }
    .secundario { color: var(--text-color-secondary, #6b7280); }
    .error { color: #b91c1c; display: block; }
    .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
  `],
})
export class BonoLaboratorioComponent implements OnInit {
  private readonly servicio = inject(RecepcionService);
  private readonly toast = inject(MessageService);

  readonly tablas = signal<TablaLaboratorio[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly fmt = formatoDinero;
  editorVisible = false;
  desde = hoy();
  readonly minimo = hoy();
  filas: { num_elementos: number; monto: number | null }[] = [];

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.servicio.tablasLaboratorio().subscribe({
      next: (t) => { this.tablas.set(t); this.cargando.set(false); },
      error: (e) => { this.cargando.set(false); this.toast.add({ severity: 'error', summary: 'No se cargó la tabla', detail: mensajeDeError(e) }); },
    });
  }

  ejemplo(n: number): string { return EJEMPLOS[n] ?? `${n} elementos`; }

  nueva(): void {
    const base = this.tablas().find((t) => t.estado === 'PROXIMA') ?? this.tablas().find((t) => t.estado === 'VIGENTE');
    this.filas = base ? base.tramos.map((t) => ({ num_elementos: t.num_elementos, monto: +t.monto }))
      : [1, 2, 3].map((n) => ({ num_elementos: n, monto: null }));
    this.desde = hoy();
    this.editorVisible = true;
  }

  agregar(): void {
    const max = Math.max(0, ...this.filas.map((f) => f.num_elementos));
    this.filas.push({ num_elementos: Math.min(9, max + 1), monto: null });
  }

  repetidas(): boolean { return new Set(this.filas.map((f) => f.num_elementos)).size !== this.filas.length; }

  valida(): boolean {
    return !!this.desde && this.desde >= this.minimo && this.filas.length > 0 && !this.repetidas()
      && this.filas.every((f) => f.num_elementos >= 1 && f.monto !== null && f.monto >= 0);
  }

  publicar(): void {
    this.guardando.set(true);
    this.servicio.publicarTablaLaboratorio(this.desde, this.filas.map((f) => ({ num_elementos: f.num_elementos, monto: f.monto! }))).subscribe({
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
