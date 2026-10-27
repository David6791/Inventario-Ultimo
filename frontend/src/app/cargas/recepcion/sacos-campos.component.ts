import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { formatoDinero } from '../../caja/core/dinero';
import { DatosSacos, FotoRecepcion } from '../core/models/cargas.model';
import { FotoSimpleComponent } from './fotos/foto-simple.component';

export type ModoSacos = 'TOTAL' | 'DETALLE';
const CLAVE_MODO = 'cargas.sacos.modo';

function pesada(fb: FormBuilder, sacos = 1) {
  return fb.group({
    sacos: [sacos as number | null, [Validators.required, Validators.min(1)]],
    peso_kg: [null as number | null, [Validators.required, Validators.min(0.01)]],
    foto_id: [null as number | null, Validators.required],
  });
}

/** Grupo de la balanza manual: modo (un total o pesada por pesada), las pesadas y el transporte. */
export function grupoSacos(fb: FormBuilder): FormGroup {
  let modo: ModoSacos = 'TOTAL';
  try { modo = (localStorage.getItem(CLAVE_MODO) as ModoSacos) || 'TOTAL'; } catch { /* sin almacenamiento */ }
  return fb.group({
    modo: [modo],
    bascula: ['BALANZA MANUAL', [Validators.required, Validators.maxLength(40)]],
    pesadas: fb.array([pesada(fb, modo === 'TOTAL' ? (null as unknown as number) : 1)]),
    placa: [null as string | null],
    chofer_nombre: [null as string | null],
    chofer_ci: [null as string | null],
  });
}

/** Datos para el API: las pesadas con su foto, sin el modo. */
export function datosSacos(g: FormGroup, conTransporte: boolean): DatosSacos {
  const v = g.getRawValue();
  return {
    bascula: v.bascula,
    pesadas: v.pesadas.map((p: { sacos: number; peso_kg: number; foto_id: number }) => ({ sacos: p.sacos, peso_kg: p.peso_kg, foto_id: p.foto_id })),
    ...(conTransporte ? { placa: v.placa, chofer_nombre: v.chofer_nombre, chofer_ci: v.chofer_ci } : {}),
  };
}

/**
 * Pesaje en la balanza manual. Se configura en el momento: un solo total
 * (cantidad de sacos y peso, con una foto) o pesada por pesada (cada saco o
 * cada tanda con su peso y su foto). La foto de cada pesada es obligatoria.
 */
@Component({
  selector: 'app-sacos-campos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputNumberModule, InputTextModule, SelectButtonModule, FotoSimpleComponent],
  template: `
    <div [formGroup]="grupo()" class="sacos">
      <div class="fila-cabeza">
        <p-selectButton [options]="modos" [allowEmpty]="false" formControlName="modo" optionLabel="etiqueta" optionValue="valor" (onChange)="cambiarModo()" />
        <div class="campo balanza">
          <label for="balanza-manual">Balanza</label>
          <input id="balanza-manual" pInputText formControlName="bascula" maxlength="40" />
        </div>
      </div>

      <div formArrayName="pesadas" class="pesadas">
        <div class="pesada encabezado">
          <span>#</span><span>Sacos</span><span>Peso (kg)</span><span>Foto</span><span></span>
        </div>
        <div class="pesada" *ngFor="let p of pesadas.controls; let i = index" [formGroupName]="i">
          <span class="orden">{{ i + 1 }}</span>
          <p-inputNumber formControlName="sacos" [min]="1" [useGrouping]="false" [inputStyle]="{ width: '100%' }"
                         [ariaLabel]="'Sacos de la pesada ' + (i + 1)" />
          <p-inputNumber formControlName="peso_kg" mode="decimal" locale="es-BO" [maxFractionDigits]="2" [min]="0"
                         [inputStyle]="{ width: '100%' }" [ariaLabel]="'Peso de la pesada ' + (i + 1)" />
          <app-foto-simple (subida)="fotoSubida(i, $event)" [etiqueta]="p.value.foto_id ? '' : 'Foto'" />
          <p-button *ngIf="modo() === 'DETALLE' && pesadas.length > 1" icon="pi pi-trash" [text]="true" severity="danger"
                    (onClick)="quitar(i)" [ariaLabel]="'Quitar la pesada ' + (i + 1)" />
        </div>
      </div>
      <div class="pie-sacos">
        <p-button *ngIf="modo() === 'DETALLE'" label="Agregar pesada" icon="pi pi-plus" [text]="true" (onClick)="agregar()" />
        <span class="total">{{ totalSacos() }} sacos · <strong class="codigo">{{ fmt(totalKg()) }} kg</strong></span>
      </div>
      <small class="falta" *ngIf="faltanFotos() > 0">Falta la foto de {{ faltanFotos() === 1 ? 'una pesada' : faltanFotos() + ' pesadas' }}:
        es el respaldo del pesaje.</small>

      <div class="transporte" *ngIf="conTransporte()">
        <div class="campo"><label for="s-placa">Placa <span class="opcional">(opcional)</span></label>
          <input id="s-placa" pInputText formControlName="placa" maxlength="15" class="codigo" /></div>
        <div class="campo ancho"><label for="s-chofer">Quién entrega <span class="opcional">(opcional)</span></label>
          <input id="s-chofer" pInputText formControlName="chofer_nombre" maxlength="150" /></div>
        <div class="campo"><label for="s-ci">CI <span class="opcional">(opcional)</span></label>
          <input id="s-ci" pInputText formControlName="chofer_ci" maxlength="15" /></div>
      </div>
    </div>
  `,
  styles: [`
    .sacos { display: flex; flex-direction: column; gap: 0.7rem; }
    .fila-cabeza { display: flex; gap: 1rem; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; }
    .campo { display: flex; flex-direction: column; gap: 0.3rem; }
    .campo label { font-size: 0.8rem; font-weight: 550; }
    .balanza { min-width: 12rem; }
    .pesadas { display: flex; flex-direction: column; gap: 0.4rem; }
    .pesada { display: grid; grid-template-columns: 1.6rem minmax(4.5rem, 6rem) minmax(7rem, 1fr) auto 2.5rem; gap: 0.5rem; align-items: center; }
    .pesada.encabezado { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-color-secondary, #6b7280); }
    .orden { font-family: ui-monospace, monospace; color: var(--text-color-secondary, #6b7280); text-align: right; }
    .pie-sacos { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .total { margin-left: auto; font-size: 0.95rem; }
    .falta { color: #b45309; }
    .transporte { display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 0.8rem; }
    @media (max-width: 640px) { .transporte { grid-template-columns: 1fr; } }
    .opcional { font-weight: 400; color: var(--text-color-secondary, #9ca3af); }
    .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
  `],
})
export class SacosCamposComponent implements OnInit {
  readonly grupo = input.required<FormGroup>();
  readonly conTransporte = input(false);

  private readonly fb = inject(FormBuilder);
  private readonly destruir = inject(DestroyRef);

  readonly modos = [{ valor: 'TOTAL', etiqueta: 'Un total' }, { valor: 'DETALLE', etiqueta: 'Pesada por pesada' }];
  readonly modo = signal<ModoSacos>('TOTAL');
  readonly totalKg = signal(0);
  readonly totalSacos = signal(0);
  readonly faltanFotos = signal(0);
  readonly fmt = formatoDinero;

  get pesadas(): FormArray { return this.grupo().get('pesadas') as FormArray; }

  ngOnInit(): void {
    this.modo.set(this.grupo().value.modo);
    this.calcular();
    this.grupo().valueChanges.pipe(takeUntilDestroyed(this.destruir)).subscribe(() => this.calcular());
  }

  private calcular(): void {
    const ps = this.pesadas.getRawValue() as { sacos: number | null; peso_kg: number | null; foto_id: number | null }[];
    this.totalKg.set(Math.round(ps.reduce((s, p) => s + (p.peso_kg ?? 0), 0) * 100) / 100);
    this.totalSacos.set(ps.reduce((s, p) => s + (p.sacos ?? 0), 0));
    this.faltanFotos.set(ps.filter((p) => !p.foto_id).length);
  }

  cambiarModo(): void {
    const m = this.grupo().value.modo as ModoSacos;
    this.modo.set(m);
    try { localStorage.setItem(CLAVE_MODO, m); } catch { /* sin almacenamiento */ }
    if (m === 'TOTAL') {
      while (this.pesadas.length > 1) this.pesadas.removeAt(this.pesadas.length - 1);
    } else if (!this.pesadas.at(0).value.sacos) {
      this.pesadas.at(0).patchValue({ sacos: 1 });
    }
  }

  agregar(): void {
    const ultima = this.pesadas.at(this.pesadas.length - 1)?.value;
    this.pesadas.push(pesada(this.fb, ultima?.sacos ?? 1));
  }

  quitar(i: number): void { this.pesadas.removeAt(i); }

  fotoSubida(i: number, f: FotoRecepcion): void {
    this.pesadas.at(i).patchValue({ foto_id: f.id });
  }
}
