import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { formatoDinero } from '../../caja/core/dinero';
import { BonoCalculado } from '../core/models/cargas.model';
import { RecepcionService } from '../core/services/recepcion.service';

const CLAVE_BASCULA = 'cargas.ultima-bascula';

/** Grupo de campos del pesaje (para la recepción y para agregar pesajes a un lote). */
export function grupoPesaje(fb: FormBuilder): FormGroup {
  let bascula = '';
  try { bascula = localStorage.getItem(CLAVE_BASCULA) ?? ''; } catch { /* sin almacenamiento */ }
  return fb.group({
    tipo: ['INGRESO'],
    bascula: [bascula, [Validators.required, Validators.maxLength(40)]],
    ticket: ['', [Validators.required, Validators.maxLength(30)]],
    peso_bruto_kg: [null as number | null, [Validators.required, Validators.min(0.01)]],
    tara_kg: [null as number | null, [Validators.required, Validators.min(0)]],
    peso_cliente_kg: [null as number | null, [Validators.min(0.01)]],
    num_sacos: [null as number | null],
    placa: [null as string | null],
    chofer_nombre: ['' as string | null, [Validators.required, Validators.maxLength(150)]],
    chofer_ci: [null as string | null],
  });
}

/** Recuerda la última báscula usada en este navegador. */
export function recordarBascula(valor: string | null | undefined): void {
  try { if (valor) localStorage.setItem(CLAVE_BASCULA, valor); } catch { /* sin almacenamiento */ }
}

/**
 * Campos del pesaje con el peso neto y el bono que corresponde, calculados en
 * vivo. El neto y el monto definitivos los pone la base.
 */
@Component({
  selector: 'app-pesaje-campos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InputNumberModule, InputTextModule],
  template: `
    <div class="campos" [formGroup]="grupo()">
      <div class="campo span-2">
        <label for="bascula">Báscula</label>
        <input id="bascula" pInputText formControlName="bascula" maxlength="40" placeholder="Potosí 1" />
      </div>
      <div class="campo span-2">
        <label for="ticket">N.º de ticket</label>
        <input id="ticket" pInputText formControlName="ticket" maxlength="30" class="codigo" />
      </div>
      <div class="campo span-2">
        <label for="sacos">Sacos <span class="opcional">(opcional)</span></label>
        <p-inputNumber inputId="sacos" formControlName="num_sacos" [min]="0" [useGrouping]="false" />
      </div>

      <div class="campo span-2">
        <label for="bruto">Peso bruto (kg)</label>
        <p-inputNumber inputId="bruto" formControlName="peso_bruto_kg" mode="decimal" locale="es-BO" [maxFractionDigits]="2" [min]="0" />
      </div>
      <div class="campo span-2">
        <label for="tara">Tara (kg)</label>
        <p-inputNumber inputId="tara" formControlName="tara_kg" mode="decimal" locale="es-BO" [maxFractionDigits]="2" [min]="0" />
      </div>
      <div class="campo span-2">
        <label>Peso neto (kg)</label>
        <div class="neto" [class.error]="neto() !== null && neto()! <= 0">{{ neto() === null ? '—' : fmt(neto()) }}</div>
        <small *ngIf="neto() !== null && neto()! <= 0" class="error">La tara debe ser menor que el bruto.</small>
      </div>

      <div class="campo span-2">
        <label for="cliente">Peso del cliente (kg) <span class="opcional">(opcional)</span></label>
        <p-inputNumber inputId="cliente" formControlName="peso_cliente_kg" mode="decimal" locale="es-BO" [maxFractionDigits]="2" [min]="0" />
      </div>
      <div class="campo span-4 diferencia">
        <ng-container *ngIf="diferencia() as d; else sinCliente">
          <span [class.error]="d.alerta">Diferencia con la báscula: <strong class="codigo">{{ d.kg > 0 ? '+' : '' }}{{ fmt(d.kg) }} kg</strong>
            ({{ d.kg > 0 ? '+' : '' }}{{ fmt(d.pct) }} %). Vale el peso de la empresa.</span>
        </ng-container>
        <ng-template #sinCliente><small class="secundario">Si el productor declara su propio peso, anótelo para comparar. Si no, cuenta solo el de la empresa.</small></ng-template>
      </div>

      <div class="campo span-2">
        <label for="placa">Placa</label>
        <input id="placa" pInputText formControlName="placa" maxlength="15" placeholder="1234ABC" class="codigo" />
      </div>
      <div class="campo span-3">
        <label for="chofer">Chofer</label>
        <input id="chofer" pInputText formControlName="chofer_nombre" maxlength="150" />
      </div>
      <div class="campo span-1">
        <label for="chofer_ci">CI</label>
        <input id="chofer_ci" pInputText formControlName="chofer_ci" maxlength="15" />
      </div>

      <div class="campo span-6" *ngIf="neto() !== null && neto()! > 0">
        <div class="bono" [class.sin-bono]="!bono()">
          <i class="pi" [class.pi-truck]="bono()" [class.pi-info-circle]="!bono()"></i>
          <span *ngIf="bono() as b">Bono de transporte: <strong>{{ b.moneda === 'USD' ? 'US$' : 'Bs' }} {{ fmt(b.monto) }}</strong>
            ({{ b.tipo_vehiculo }}). Lo cobra el chofer en caja.</span>
          <span *ngIf="!bono()">Para este peso no corresponde bono de transporte.</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .campos { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.9rem 1rem; }
    .campo { display: flex; flex-direction: column; gap: 0.35rem; }
    .campo label { font-size: 0.8rem; font-weight: 550; }
    .campo :is(input, .p-inputnumber) { width: 100%; }
    :host ::ng-deep .campo .p-inputnumber input { width: 100%; }
    .span-1 { grid-column: span 1; } .span-2 { grid-column: span 2; } .span-3 { grid-column: span 3; } .span-4 { grid-column: span 4; } .span-6 { grid-column: span 6; }
    @media (max-width: 720px) { .campos { grid-template-columns: repeat(2, 1fr); } .span-1, .span-2, .span-3 { grid-column: span 1; } .span-4, .span-6 { grid-column: span 2; } }
    .neto { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 1.25rem; font-weight: 700; padding: 0.35rem 0; }
    .error { color: #b91c1c; }
    .diferencia { justify-content: flex-end; padding-bottom: 0.55rem; font-size: 0.88rem; }
    .secundario { color: var(--text-color-secondary, #6b7280); }
    .opcional { font-weight: 400; color: var(--text-color-secondary, #9ca3af); }
    .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
    .bono { display: flex; gap: 0.6rem; align-items: center; padding: 0.6rem 0.9rem; border-radius: 8px;
            background: #f0fdf4; border: 1px solid #bbf7d0; font-size: 0.88rem; }
    .bono.sin-bono { background: var(--surface-ground, #f8fafc); border-color: var(--surface-border, #e5e7eb); }
  `],
})
export class PesajeCamposComponent implements OnInit {
  readonly grupo = input.required<FormGroup>();

  private readonly servicio = inject(RecepcionService);
  private readonly destruir = inject(DestroyRef);

  readonly neto = signal<number | null>(null);
  readonly bono = signal<BonoCalculado | null>(null);
  readonly cliente = signal<number | null>(null);
  /** Diferencia del peso declarado por el cliente con el neto de la báscula; alerta sobre 1 %. */
  readonly diferencia = computed(() => {
    const n = this.neto(), c = this.cliente();
    if (n === null || n <= 0 || c === null || c <= 0) return null;
    const kg = Math.round((c - n) * 100) / 100;
    const pct = Math.round((kg / n) * 10000) / 100;
    return { kg, pct, alerta: Math.abs(pct) > 1 };
  });
  readonly fmt = formatoDinero;

  ngOnInit(): void {
    this.grupo().get('peso_cliente_kg')!.valueChanges.pipe(takeUntilDestroyed(this.destruir))
      .subscribe((v) => this.cliente.set(v ?? null));
    this.grupo().valueChanges.pipe(
      map((v) => (v.peso_bruto_kg != null && v.tara_kg != null ? Math.round((v.peso_bruto_kg - v.tara_kg) * 100) / 100 : null)),
      distinctUntilChanged(),
      switchMap((neto) => {
        this.neto.set(neto);
        return neto && neto > 0 ? this.servicio.calcularBono(neto).pipe(debounceTime(0)) : of(null);
      }),
      takeUntilDestroyed(this.destruir),
    ).subscribe((b) => this.bono.set(b));
  }
}
