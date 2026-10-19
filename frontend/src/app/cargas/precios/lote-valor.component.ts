import { CommonModule } from '@angular/common';
import { Component, OnChanges, inject, input, signal } from '@angular/core';
import { formatoDinero } from '../../caja/core/dinero';
import { Lote, ValorLote } from '../core/models/cargas.model';
import { formatoLey } from '../core/numeros';
import { PreciosService } from '../core/services/precios.service';

/**
 * Valor estimado del lote en su ficha: peso seco × valor por TM de cada
 * elemento pagable, con la tabla y la cotización vigentes a la recepción.
 * Sin descuentos ni retenciones (eso es la liquidación).
 */
@Component({
  selector: 'app-lote-valor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="valor" *ngIf="valor() as v">
      <div class="cabeza">
        <h3 class="titulo-seccion">Valor estimado</h3>
        <div class="totales">
          <span *ngFor="let t of totales(v)" class="total">{{ t.moneda === 'USD' ? 'US$' : 'Bs' }} {{ dinero(t.monto) }}</span>
          <span class="pastilla" [class.pastilla-ok]="v.definitivo" [class.pastilla-aviso]="!v.definitivo">
            {{ v.definitivo ? 'con ley final' : 'provisional' }}</span>
        </div>
      </div>
      <p class="secundario nota">Tablas y cotizaciones vigentes al {{ v.fecha | date: 'dd/MM/yyyy' }} (recepción). Sin descuentos, regalía
        ni retenciones: eso se calcula en la liquidación.</p>
      <table>
        <thead><tr><th>Elemento</th><th class="derecha">Ley</th><th>Tabla</th><th class="derecha">Valor por TM</th>
                   <th class="derecha">Peso seco</th><th class="derecha">Valor</th></tr></thead>
        <tbody>
          <tr *ngFor="let e of v.elementos">
            <td><b>{{ e.elemento }}</b></td>
            <td class="derecha monto">{{ ley(e.ley) }} <span class="secundario">{{ e.unidad_ley }}</span>
              <div class="secundario fuente">{{ fuente(e.fuente) }}</div></td>
            <td>{{ e.modalidad ? (e.modalidad === 'POR_PUNTO' ? 'por punto' : 'por porcentaje') + ' · ' + e.moneda : '—' }}
              <div class="secundario" *ngIf="e.cotizacion">cotización {{ e.cotizacion_tipo?.toLowerCase() }} {{ ley(e.cotizacion) }}</div></td>
            <td class="derecha monto">{{ e.valor_por_tm !== null ? dinero(e.valor_por_tm) : '—' }}</td>
            <td class="derecha monto">{{ e.peso_seco_tm !== null ? ley(e.peso_seco_tm) + ' t' : '—' }}</td>
            <td class="derecha monto fuerte">{{ e.valor !== null ? dinero(e.valor) : '—' }}
              <div class="obs" *ngIf="e.observacion" [class.rojo]="e.valor === null">{{ e.observacion }}</div></td>
          </tr>
        </tbody>
      </table>
    </section>
  `,
  styles: [`
    .valor { margin-top: 1.2rem; }
    .cabeza { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .titulo-seccion { font-size: 0.95rem; margin: 0; }
    .totales { display: flex; gap: 0.8rem; align-items: center; }
    .total { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 1.15rem; font-weight: 700; }
    .nota { font-size: 0.8rem; margin: 0.3rem 0 0.5rem; }
    .secundario { color: var(--text-color-secondary, #6b7280); }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th { text-align: left; font-size: 0.7rem; text-transform: uppercase; color: var(--text-color-secondary, #6b7280); padding: 0.4rem 0.5rem;
         border-bottom: 1px solid var(--surface-border, #e5e7eb); }
    td { padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--surface-border, #f1f5f9); vertical-align: top; }
    .derecha, th.derecha { text-align: right; }
    .monto { font-family: ui-monospace, 'SF Mono', Menlo, monospace; white-space: nowrap; }
    .fuerte { font-weight: 700; }
    .fuente { font-family: inherit; font-size: 0.75rem; }
    .obs { font-family: inherit; font-weight: 400; font-size: 0.75rem; white-space: normal; color: #92400e; max-width: 18rem; margin-left: auto; }
    .obs.rojo { color: #b91c1c; }
    .pastilla { display: inline-block; padding: 0.08rem 0.45rem; font-size: 0.7rem; font-weight: 600; border-radius: 4px; }
    .pastilla-ok { background: #dcfce7; color: #166534; } .pastilla-aviso { background: #fef3c7; color: #92400e; }
  `],
})
export class LoteValorComponent implements OnChanges {
  readonly lote = input.required<Lote>();
  private readonly servicio = inject(PreciosService);
  readonly valor = signal<ValorLote | null>(null);

  ngOnChanges(): void {
    this.servicio.valorLote(this.lote().id).subscribe({ next: (v) => this.valor.set(v), error: () => this.valor.set(null) });
  }

  totales(v: ValorLote): { moneda: string; monto: number }[] {
    return Object.entries(v.totales).map(([moneda, monto]) => ({ moneda, monto }));
  }
  dinero(v: string | number): string { return formatoDinero(v); }
  ley(v: string | number | null): string { return formatoLey(v); }
  fuente(f: string | null): string {
    return ({ LEY_FINAL: 'ley final', ANALISIS_EMPRESA: 'análisis de la empresa', LECTURA_ESTIMADA: 'lectura estimada' } as Record<string, string>)[f ?? ''] ?? '';
  }
}
