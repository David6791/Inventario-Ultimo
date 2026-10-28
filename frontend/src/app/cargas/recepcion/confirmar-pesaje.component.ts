import { CommonModule } from '@angular/common';
import { Component, OnDestroy, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { formatoDinero } from '../../caja/core/dinero';
import { CriterioPeso } from '../core/models/cargas.model';
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
  num_sacos?: number | null;
  placa?: string | null;
  chofer_nombre?: string | null;
  chofer_ci?: string | null;
  foto_interior_id?: number | null;
  foto_exterior_id?: number | null;
}

/**
 * Registro manual: antes de guardar se muestra todo lo anotado junto a la foto
 * de la boleta, y la persona confirma que lo revisó dato por dato. Es la
 * verificación que en los lectores hace la comparación con lo leído.
 */
@Component({
  selector: 'app-confirmar-pesaje',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, CheckboxModule, DialogModule],
  template: `
    <p-dialog [(visible)]="visible" header="Confirme los datos antes de guardar" [modal]="true" appendTo="body"
              [style]="{ width: '52rem', maxWidth: '96vw' }" [draggable]="false" (onHide)="revisado = false">
      <div class="confirmar">
        <div class="boleta">
          <img *ngIf="vista() as v; else sinFoto" [src]="v" alt="Boleta interior" (click)="ampliada.set(!ampliada())" [class.ampliada]="ampliada()" />
          <ng-template #sinFoto><div class="sin-foto"><i class="pi pi-image"></i> Sin foto de la boleta</div></ng-template>
          <small class="secundario" *ngIf="vista()">Toque la foto para ampliarla.</small>
        </div>
        <div class="datos">
          <div class="extra" *ngFor="let e of extras()"><span>{{ e.etiqueta }}</span><strong>{{ e.valor || '—' }}</strong></div>
          <div class="fila"><span>Báscula</span><strong>{{ datos()?.bascula || '—' }}</strong></div>
          <div class="fila"><span>N.º de ticket</span><strong class="codigo">{{ datos()?.ticket || '—' }}</strong></div>
          <div class="fila" *ngIf="datos()?.numero_orden"><span>N.º de orden</span><strong class="codigo">{{ datos()?.numero_orden }}</strong></div>
          <div class="fila" *ngIf="datos()?.fecha_ticket"><span>Fecha de la boleta</span><strong>{{ fecha(datos()?.fecha_ticket) }}</strong></div>
          <div class="fila peso"><span>Peso bruto</span><strong class="codigo">{{ kg(datos()?.peso_bruto_kg) }}</strong></div>
          <div class="fila peso"><span>Tara</span><strong class="codigo">{{ kg(datos()?.tara_kg) }}</strong></div>
          <div class="fila peso neto"><span>Peso neto</span><strong class="codigo">{{ kg(neto()) }}</strong></div>
          <div class="fila peso" *ngIf="datos()?.peso_cliente_kg">
            <span>Peso del cliente ({{ datos()?.peso_cliente_tipo === 'BRUTO' ? 'bruto' : 'neto' }})</span>
            <strong class="codigo">{{ kg(datos()?.peso_cliente_kg) }}</strong></div>
          <div class="fila vale" *ngIf="vale() as v"><span>Peso que vale</span>
            <strong class="codigo">{{ kg(v.kg) }} <small>({{ etiquetaCriterio[v.criterio] }})</small></strong></div>
          <div class="fila" *ngIf="datos()?.num_sacos"><span>Sacos</span><strong>{{ datos()?.num_sacos }}</strong></div>
          <div class="fila"><span>Placa</span><strong class="codigo">{{ datos()?.placa || '—' }}</strong></div>
          <div class="fila"><span>Chofer</span><strong>{{ datos()?.chofer_nombre || '—' }}{{ datos()?.chofer_ci ? ' · CI ' + datos()?.chofer_ci : '' }}</strong></div>
          <div class="fila"><span>Boleta del cliente</span><strong>{{ datos()?.foto_exterior_id ? 'Foto adjunta' : 'Sin foto' }}</strong></div>
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
    .revisado { display: flex; gap: 0.6rem; align-items: center; margin-top: 1rem; padding: 0.7rem 0.9rem; border-radius: 8px;
                background: #fef3c7; color: #78350f; font-weight: 550; cursor: pointer; }
    .secundario { color: var(--text-color-secondary, #6b7280); font-size: 0.75rem; }
    .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
  `],
})
export class ConfirmarPesajeComponent implements OnDestroy {
  readonly visible = model(false);
  readonly datos = input<PesajeAConfirmar | null>(null);
  readonly vale = input<{ kg: number; criterio: CriterioPeso } | null>(null);
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
