import { CommonModule } from '@angular/common';
import { Component, OnDestroy, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { formatoDinero } from '../../caja/core/dinero';
import { PesoQueVale } from '../core/models/cargas.model';
import { ETIQUETA_CRITERIO } from '../core/peso-que-vale';
import { RecepcionService } from '../core/services/recepcion.service';

/** Datos del pesaje tal como están en el formulario. */
export interface PesajeAConfirmar {
  bascula?: string | null;
  ticket?: string | null;
  numero_orden?: string | null;
  fecha_ticket?: string | null;
  peso_bruto_kg?: number | null;
  tara_kg?: number | null;
  peso_cliente_kg?: number | null;
  peso_cliente_tipo?: 'NETO' | 'BRUTO' | null;
  peso_cliente_bruto_kg?: number | null;
  peso_cliente_tara_kg?: number | null;
  num_sacos?: number | null;
  placa?: string | null;
  chofer_nombre?: string | null;
  chofer_ci?: string | null;
  foto_interior_id?: number | null;
  foto_exterior_id?: number | null;
}

/**
 * Antes de guardar (a mano, con Tesseract o con Claude) se muestra todo lo
 * anotado junto a la foto de la boleta, con las diferencias contra lo leído,
 * y la persona confirma que lo revisó dato por dato.
 */
@Component({
  selector: 'app-confirmar-pesaje',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, CheckboxModule, DialogModule],
  template: `
    <p-dialog [(visible)]="visible" header="Confirme los datos antes de guardar" [modal]="true" appendTo="body"
              [style]="{ width: '52rem', maxWidth: '96vw' }" [draggable]="false" (onHide)="revisado = false">
      <div class="diferencias" *ngIf="diferencias().length">
        <b><i class="pi pi-exclamation-triangle"></i> Lo leído de la boleta no coincide con lo anotado:</b>
        <ul><li *ngFor="let d of diferencias()">{{ d }}</li></ul>
      </div>
      <div class="confirmar">
        <div class="boleta">
          <img *ngIf="vista() as v; else sinFoto" [src]="v" alt="Boleta interior" (click)="ampliada.set(!ampliada())" [class.ampliada]="ampliada()" />
          <ng-template #sinFoto><div class="sin-foto"><i class="pi pi-image"></i> Sin foto de la boleta</div></ng-template>
          <small class="secundario" *ngIf="vista()">Toque la foto para ampliarla.</small>
        </div>
        <div class="datos">
          <div class="extra" *ngFor="let e of extras()"><span>{{ e.etiqueta }}</span><strong>{{ e.valor || '—' }}</strong></div>
          <ng-container *ngIf="datos() as d">
          <div class="fila"><span>Placa</span><strong class="codigo">{{ d.placa || '—' }}</strong></div>
          <div class="fila"><span>Chofer</span><strong>{{ d.chofer_nombre || '—' }}{{ d.chofer_ci ? ' · CI ' + d.chofer_ci : '' }}</strong></div>
          <div class="fila" *ngIf="d.numero_orden"><span>N.º de orden</span><strong class="codigo">{{ d.numero_orden }}</strong></div>
          <div class="fila" *ngIf="d.fecha_ticket"><span>Fecha de la boleta</span><strong>{{ fecha(d.fecha_ticket) }}</strong></div>
          <table class="pesos">
            <thead><tr><th></th><th>Nuestra báscula</th><th>Cliente</th></tr></thead>
            <tbody>
              <tr><td>Bruto</td><td class="codigo">{{ kg(d.peso_bruto_kg) }}</td><td class="codigo">{{ kg(d.peso_cliente_bruto_kg) }}</td></tr>
              <tr><td>Tara</td><td class="codigo">{{ kg(d.tara_kg) }}</td><td class="codigo">{{ kg(d.peso_cliente_tara_kg) }}</td></tr>
              <tr class="neto"><td>Neto</td><td class="codigo">{{ kg(neto()) }}</td><td class="codigo">{{ kg(netoCliente()) }}</td></tr>
            </tbody>
          </table>
          <div class="fila vale" *ngIf="vale() as v"><span>Peso que vale</span>
            <strong class="codigo">{{ kg(v.kg) }} <small>({{ etiquetaCriterio[v.criterio] }}{{ v.regla ? ' · ' + v.regla.formula : '' }})</small></strong></div>
          <div class="fila"><span>Báscula · ticket</span><strong>{{ d.bascula || '—' }} · <span class="codigo">{{ d.ticket || '—' }}</span></strong></div>
          <div class="fila" *ngIf="d.num_sacos"><span>Sacos</span><strong>{{ d.num_sacos }}</strong></div>
          <div class="fila"><span>Boleta del cliente</span><strong>{{ d.foto_exterior_id ? 'Foto adjunta' : 'Sin foto' }}</strong></div>
          </ng-container>
        </div>
      </div>
      <label class="revisado">
        <p-checkbox [(ngModel)]="revisado" [binary]="true" inputId="revisado" />
        <span>Revisé cada dato contra la boleta y están correctos.</span>
      </label>
      <ng-template pTemplate="footer">
        <p-button label="Volver a corregir" [text]="true" (onClick)="visible.set(false)" />
        <p-button label="Confirmar y guardar" icon="pi pi-check" [disabled]="!revisado" (onClick)="confirmar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .confirmar { display: grid; grid-template-columns: minmax(10rem, 18rem) 1fr; gap: 1.2rem; align-items: start; }
    @media (max-width: 640px) { .confirmar { grid-template-columns: 1fr; } }
    .boleta { display: flex; flex-direction: column; gap: 0.3rem; }
    .boleta img { width: 100%; border-radius: 6px; border: 1px solid var(--surface-border, #e5e7eb); cursor: zoom-in; }
    .boleta img.ampliada { position: fixed; inset: 3vh 3vw; width: auto; height: 94vh; max-width: 94vw; margin: auto; z-index: 2000;
                           object-fit: contain; background: #fff; cursor: zoom-out; box-shadow: 0 10px 40px rgba(0,0,0,0.35); }
    .sin-foto { padding: 2.5rem 0.5rem; text-align: center; border: 1px dashed var(--surface-border, #cbd5e1); border-radius: 6px;
                color: var(--text-color-secondary, #6b7280); }
    .datos { display: flex; flex-direction: column; }
    .fila, .extra { display: flex; justify-content: space-between; gap: 1rem; padding: 0.35rem 0; border-bottom: 1px solid var(--surface-border, #eef0f3);
                    font-size: 0.9rem; }
    .fila span, .extra span { color: var(--text-color-secondary, #6b7280); }
    .fila strong, .extra strong { text-align: right; }
    .peso strong { font-size: 1rem; }
    .neto strong { font-size: 1.1rem; }
    .vale { background: #eef2ff; padding: 0.45rem 0.5rem; border-radius: 6px; border-bottom: 0; margin: 0.2rem 0; }
    .vale small { font-weight: 400; font-family: inherit; }
    .diferencias { padding: 0.6rem 0.9rem; border-radius: 8px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412;
                   font-size: 0.88rem; margin-bottom: 0.9rem; }
    .diferencias ul { margin: 0.35rem 0 0; padding-left: 1.2rem; }
    table.pesos { width: 100%; border-collapse: collapse; margin: 0.35rem 0; font-size: 0.9rem; }
    table.pesos th { text-align: right; font-size: 0.7rem; text-transform: uppercase; color: var(--text-color-secondary, #6b7280); padding: 0.2rem 0.3rem; }
    table.pesos td { text-align: right; padding: 0.3rem; border-bottom: 1px solid var(--surface-border, #eef0f3); }
    table.pesos td:first-child { text-align: left; color: var(--text-color-secondary, #6b7280); }
    table.pesos tr.neto td { font-weight: 700; font-size: 1rem; }
    .revisado { display: flex; gap: 0.6rem; align-items: center; margin-top: 1rem; padding: 0.7rem 0.9rem; border-radius: 8px;
                background: #fef3c7; color: #78350f; font-weight: 550; cursor: pointer; }
    .secundario { color: var(--text-color-secondary, #6b7280); font-size: 0.75rem; }
    .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
  `],
})
export class ConfirmarPesajeComponent implements OnDestroy {
  readonly visible = model(false);
  readonly datos = input<PesajeAConfirmar | null>(null);
  readonly vale = input<PesoQueVale | null>(null);
  /** Diferencias entre lo leído de la boleta y lo anotado. */
  readonly diferencias = input<string[]>([]);
  /** Otros datos del registro que conviene ver (productor, sede, tipo de pesaje…). */
  readonly extras = input<{ etiqueta: string; valor: string | null | undefined }[]>([]);
  readonly confirmado = output<void>();

  private readonly servicio = inject(RecepcionService);
  readonly vista = signal<string | null>(null);
  readonly ampliada = signal(false);
  readonly etiquetaCriterio = ETIQUETA_CRITERIO;
  revisado = false;
  private fotoCargada: number | null = null;

  constructor() {
    effect(() => {
      const id = this.visible() ? this.datos()?.foto_interior_id ?? null : null;
      if (!id || id === this.fotoCargada) return;
      this.fotoCargada = id;
      this.servicio.foto(id).subscribe({
        next: (b) => this.ponerVista(URL.createObjectURL(b)),
        error: () => this.ponerVista(null),
      });
    }, { allowSignalWrites: true });
  }

  neto(): number | null {
    const d = this.datos();
    return d?.peso_bruto_kg != null && d.tara_kg != null ? Math.round((d.peso_bruto_kg - d.tara_kg) * 100) / 100 : null;
  }

  netoCliente(): number | null {
    const d = this.datos();
    if (d?.peso_cliente_bruto_kg != null && d.peso_cliente_tara_kg != null) return Math.round((d.peso_cliente_bruto_kg - d.peso_cliente_tara_kg) * 100) / 100;
    return d?.peso_cliente_tipo === 'BRUTO' ? null : d?.peso_cliente_kg ?? null;
  }

  kg(n: number | null | undefined): string { return n == null ? '—' : `${formatoDinero(n)} kg`; }

  fecha(f: string | null | undefined): string {
    if (!f) return '—';
    const d = new Date(f);
    return isNaN(d.getTime()) ? f : d.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'medium' });
  }

  confirmar(): void {
    this.visible.set(false);
    this.revisado = false;
    this.confirmado.emit();
  }

  private ponerVista(url: string | null): void {
    const anterior = this.vista();
    if (anterior) URL.revokeObjectURL(anterior);
    this.vista.set(url);
  }

  ngOnDestroy(): void { this.ponerVista(null); }
}
