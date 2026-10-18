import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToastModule } from 'primeng/toast';
import { mensajeDeError } from '../../cargas/core/errores';
import { abrirPdf } from '../core/archivos';
import { CajaOperacion, DatosCierre, Moneda, SaldoSesion } from '../core/caja.model';
import { CajaService } from '../core/caja.service';
import { DineroPipe, formatoDinero, simbolo } from '../core/dinero';
import { ESTILOS_CAJA } from '../core/estilos';

interface Conteo {
  moneda: Moneda;
  modo: 'arqueo' | 'total';
  cortes: { denominacion: number; cantidad: number | null }[];
  total: number | null;
}

/**
 * Cierre del día: se cuenta el efectivo de cada moneda (billete por billete o
 * el total), se ve lo esperado y la diferencia, y si no cuadra se explica.
 * La base vuelve a calcular todo al cerrar: lo de esta pantalla es el aviso.
 */
@Component({
  selector: 'app-cierre-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonModule, InputNumberModule, InputTextareaModule,
            SelectButtonModule, ToastModule, DineroPipe],
  providers: [MessageService],
  template: `
    <p-toast />
    <a [routerLink]="['/caja/operar', id()]" class="volver"><i class="pi pi-arrow-left"></i> Volver a la caja</a>

    <ng-container *ngIf="caja() as c">
      <header class="encabezado">
        <div>
          <h2>Cerrar caja {{ c.codigo }}</h2>
          <p class="subtitulo" *ngIf="c.sesion_abierta as s">
            Sesión {{ s.numero }}, abierta el {{ s.abierta_en | date: 'dd/MM/yyyy HH:mm' }} por {{ s.abierta_por }}.
            Cuente el efectivo que hay en caja; los cheques y transferencias no se cuentan.
          </p>
        </div>
        <div class="acciones" *ngIf="c.sesion_abierta">
          <p-button label="Reporte preliminar" icon="pi pi-file-pdf" [outlined]="true" (onClick)="reporte(c.sesion_abierta.id)" />
        </div>
      </header>

      <!-- Ya cerrada -->
      <section class="cerrada" *ngIf="cerrada() as r">
        <i class="pi pi-check-circle"></i>
        <div>
          <h3>Sesión {{ r.numero }} cerrada</h3>
          <p>Imprima el reporte del día, fírmelo y entréguelo con el efectivo al supervisor para que valide el cierre.</p>
          <div class="botones">
            <p-button label="Imprimir reporte del día" icon="pi pi-print" (onClick)="reporte(r.id)" />
            <p-button label="Volver a la caja" [text]="true" [routerLink]="['/caja/operar', id()]" />
          </div>
        </div>
      </section>

      <ng-container *ngIf="!cerrada() && c.sesion_abierta">
        <section class="monedas">
          <article class="moneda" *ngFor="let k of conteos()">
            <header>
              <h3>{{ k.moneda === 'USD' ? 'Dólares' : 'Bolivianos' }}</h3>
              <p-selectButton [options]="modos" [(ngModel)]="k.modo" optionLabel="etiqueta" optionValue="valor"
                              (onChange)="recalcular()" />
            </header>

            <table class="arqueo" *ngIf="k.modo === 'arqueo'">
              <thead><tr><th>Corte</th><th>Cantidad</th><th class="derecha">Subtotal</th></tr></thead>
              <tbody>
                <tr *ngFor="let corte of k.cortes">
                  <td class="monto">{{ simbolo(k.moneda) }} {{ formato(corte.denominacion) }}</td>
                  <td>
                    <p-inputNumber [(ngModel)]="corte.cantidad" [min]="0" [useGrouping]="false" (onInput)="recalcular()"
                                   (ngModelChange)="recalcular()" [inputStyle]="{ width: '6rem' }" placeholder="0" />
                  </td>
                  <td class="derecha monto">{{ (corte.cantidad ?? 0) * corte.denominacion | dinero }}</td>
                </tr>
              </tbody>
            </table>

            <div class="campo" *ngIf="k.modo === 'total'">
              <label>Total contado</label>
              <p-inputNumber [(ngModel)]="k.total" mode="decimal" locale="es-BO" [minFractionDigits]="2" [maxFractionDigits]="2"
                             [min]="0" [prefix]="simbolo(k.moneda) + ' '" (onInput)="recalcular()" (ngModelChange)="recalcular()" />
            </div>

            <dl class="cuadre" *ngIf="cuadre()[k.moneda] as q">
              <div><dt>Esperado</dt><dd class="monto">{{ q.esperado | dinero: k.moneda }}</dd></div>
              <div><dt>Contado</dt><dd class="monto">{{ q.contado === null ? '—' : (q.contado | dinero: k.moneda) }}</dd></div>
              <div class="diferencia" [class.cuadra]="q.diferencia === 0" [class.sobra]="(q.diferencia ?? 0) > 0"
                   [class.falta]="(q.diferencia ?? 0) < 0">
                <dt>Diferencia</dt>
                <dd class="monto">
                  <ng-container *ngIf="q.diferencia === null">—</ng-container>
                  <ng-container *ngIf="q.diferencia === 0">Cuadra</ng-container>
                  <ng-container *ngIf="q.diferencia !== null && q.diferencia !== 0">
                    {{ q.diferencia > 0 ? 'Sobra' : 'Falta' }} {{ abs(q.diferencia) | dinero: k.moneda }}
                  </ng-container>
                </dd>
              </div>
            </dl>
          </article>
        </section>

        <section class="final">
          <div class="campo">
            <label for="obs">Observaciones {{ hayDiferencia() ? '(obligatorias: explique la diferencia)' : '(opcional)' }}</label>
            <textarea id="obs" pInputTextarea rows="3" [(ngModel)]="observaciones" maxlength="1000"
                      [placeholder]="hayDiferencia() ? 'Por qué sobra o falta dinero' : ''"></textarea>
            <small *ngIf="hayDiferencia() && observaciones.trim().length < 10" class="alerta">
              Con diferencia, la explicación necesita al menos 10 caracteres.
            </small>
          </div>
          <div class="nota nota-aviso" *ngIf="!listo() && !hayDiferencia()">
            <i class="pi pi-info-circle"></i><span>Cuente todas las monedas (si no hay efectivo, ponga 0).</span>
          </div>
          <p-button label="Cerrar caja" icon="pi pi-lock" severity="danger" [loading]="cerrando()"
                    [disabled]="!listo() || (hayDiferencia() && observaciones.trim().length < 10) || cerrando()"
                    (onClick)="cerrar()" />
          <small class="secundario">Después de cerrar ya no se registran ni anulan movimientos en esta sesión.</small>
        </section>
      </ng-container>

      <div class="nota nota-neutra" *ngIf="!cerrada() && !c.sesion_abierta">
        <i class="pi pi-info-circle"></i><span>La caja no tiene una sesión abierta.</span>
      </div>
    </ng-container>
  `,
  styles: [...ESTILOS_CAJA, `
    .volver { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; margin-bottom: 0.6rem;
              color: var(--text-color-secondary, #6b7280); text-decoration: none; }
    .monedas { display: grid; grid-template-columns: repeat(auto-fit, minmax(22rem, 1fr)); gap: 1rem; margin-bottom: 1rem; }
    .moneda { border: 1px solid var(--surface-border, #e5e7eb); border-radius: 10px; padding: 1rem 1.2rem;
              background: var(--surface-card, #fff); }
    .moneda header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; }
    .moneda h3 { margin: 0; font-size: 1rem; }
    .arqueo { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .arqueo th { text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em;
                 color: var(--text-color-secondary, #6b7280); padding: 0.3rem 0; }
    .arqueo td { padding: 0.15rem 0; border-top: 1px solid var(--surface-border, #f1f5f9); }
    .cuadre { display: flex; gap: 1.4rem; margin: 0.9rem 0 0; padding-top: 0.7rem; border-top: 1px solid var(--surface-border, #e5e7eb); }
    .cuadre div { display: flex; flex-direction: column; }
    .cuadre dt { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-color-secondary, #6b7280); }
    .cuadre dd { margin: 0; font-size: 1.05rem; font-weight: 650; }
    .diferencia.cuadra dd { color: #15803d; }
    .diferencia.sobra dd { color: #b45309; }
    .diferencia.falta dd { color: #b91c1c; }
    .final { display: flex; flex-direction: column; gap: 0.7rem; align-items: flex-start; max-width: 46rem; }
    .final .campo { width: 100%; }
    .alerta { color: #b91c1c !important; }
    .cerrada { display: flex; gap: 1rem; padding: 1.4rem; border-radius: 10px; background: #f0fdf4; border: 1px solid #bbf7d0;
               max-width: 46rem; }
    .cerrada > i { font-size: 1.8rem; color: #16a34a; }
    .cerrada h3 { margin: 0 0 0.3rem; }
    .cerrada p { margin: 0 0 0.8rem; font-size: 0.9rem; }
    .botones { display: flex; gap: 0.5rem; }
  `],
})
export class CierreCajaComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly servicio = inject(CajaService);
  private readonly toast = inject(MessageService);

  readonly caja = signal<CajaOperacion | null>(null);
  readonly conteos = signal<Conteo[]>([]);
  readonly version = signal(0);   // fuerza el recálculo al escribir en los cortes
  readonly cerrando = signal(false);
  readonly cerrada = signal<{ id: number; numero: number } | null>(null);
  observaciones = '';

  readonly simbolo = simbolo;
  readonly modos = [{ valor: 'arqueo', etiqueta: 'Billete por billete' }, { valor: 'total', etiqueta: 'Solo el total' }];

  readonly cuadre = computed(() => {
    this.version();
    const saldos = this.caja()?.sesion_abierta?.saldos ?? [];
    const r: Partial<Record<Moneda, { esperado: number; contado: number | null; diferencia: number | null }>> = {};
    for (const k of this.conteos()) {
      const esperado = Number(saldos.find((s: SaldoSesion) => s.moneda === k.moneda)?.saldo_efectivo_actual ?? 0);
      const contado = this.contadoDe(k);
      r[k.moneda] = { esperado, contado, diferencia: contado === null ? null : Math.round((contado - esperado) * 100) / 100 };
    }
    return r;
  });

  readonly hayDiferencia = computed(() => Object.values(this.cuadre()).some((q) => q && q.diferencia !== null && q.diferencia !== 0));
  readonly listo = computed(() => Object.values(this.cuadre()).every((q) => q && q.contado !== null));

  ngOnInit(): void {
    this.servicio.opciones().subscribe((o) => {
      this.servicio.ver(Number(this.id())).subscribe({
        next: (c) => {
          this.caja.set(c);
          const monedas: Moneda[] = c.maneja_usd ? ['BOB', 'USD'] : ['BOB'];
          this.conteos.set(monedas.map((m) => ({
            moneda: m,
            modo: m === 'BOB' ? 'arqueo' : 'total',
            cortes: (o.denominaciones?.[m] ?? []).map((d) => ({ denominacion: d, cantidad: null })),
            total: null,
          })));
          this.recalcular();
        },
        error: (e) => this.toast.add({ severity: 'error', summary: 'No se pudo cargar la caja', detail: mensajeDeError(e), life: 10000 }),
      });
    });
  }

  formato(v: number): string { return formatoDinero(v); }
  abs(v: number): number { return Math.abs(v); }
  recalcular(): void { this.version.update((v) => v + 1); }

  /** Con arqueo, la suma de los cortes (null si no se contó nada); si no, el total escrito. */
  private contadoDe(k: Conteo): number | null {
    if (k.modo === 'total') return k.total ?? null;
    const algo = k.cortes.some((c) => c.cantidad !== null && c.cantidad !== undefined);
    if (!algo) return null;
    return Math.round(k.cortes.reduce((s, c) => s + (c.cantidad ?? 0) * c.denominacion, 0) * 100) / 100;
  }

  cerrar(): void {
    const sesion = this.caja()?.sesion_abierta;
    if (!sesion) return;

    const datos: DatosCierre = { monedas: {}, observaciones: this.observaciones.trim() || null };
    for (const k of this.conteos()) {
      datos.monedas[k.moneda] = k.modo === 'arqueo'
        ? { arqueo: k.cortes.filter((c) => (c.cantidad ?? 0) > 0).map((c) => ({ denominacion: c.denominacion, cantidad: c.cantidad! })),
            contado: this.contadoDe(k) }
        : { contado: k.total };
    }

    this.cerrando.set(true);
    this.servicio.cerrar(sesion.id, datos).subscribe({
      next: (r) => {
        this.cerrando.set(false);
        this.cerrada.set({ id: sesion.id, numero: sesion.numero });
        this.toast.add({ severity: 'success', summary: 'Caja cerrada', detail: r.mensaje, life: 8000 });
      },
      error: (e) => {
        this.cerrando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se cerró la caja', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }

  reporte(sesionId: number): void {
    this.servicio.reporteSesion(sesionId).subscribe({
      next: abrirPdf,
      error: () => this.toast.add({ severity: 'error', summary: 'No se pudo generar el reporte' }),
    });
  }
}
