import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { mensajeDeError } from '../../cargas/core/errores';
import { abrirPdf, descargar, hoy } from '../core/archivos';
import { Caja, Concepto, FiltrosLibro, LibroCaja, Moneda } from '../core/caja.model';
import { CajaService } from '../core/caja.service';
import { DineroPipe } from '../core/dinero';
import { ESTILOS_CAJA } from '../core/estilos';

/** Libro de caja por rango de fechas, caja y concepto, con PDF y Excel. */
@Component({
  selector: 'app-libro-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, CheckboxModule, DropdownModule, InputTextModule, SelectButtonModule,
            TableModule, ToastModule, DineroPipe],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Libro de caja</h2>
        <p class="subtitulo">Ingresos y egresos de un período, en efectivo y en otras formas de pago, con el resumen por concepto.</p>
      </div>
      <div class="acciones">
        <p-button label="PDF" icon="pi pi-file-pdf" [outlined]="true" [disabled]="!libro()" (onClick)="archivo('pdf')" />
        <p-button label="Excel" icon="pi pi-file-excel" [outlined]="true" [disabled]="!libro()" (onClick)="archivo('excel')" />
      </div>
    </header>

    <div class="barra filtros">
      <span class="campo-fecha"><label>Desde</label><input pInputText type="date" [(ngModel)]="f.desde" /></span>
      <span class="campo-fecha"><label>Hasta</label><input pInputText type="date" [(ngModel)]="f.hasta" /></span>
      <p-dropdown class="filtro" [options]="cajas()" [(ngModel)]="f.caja_id" optionLabel="nombre" optionValue="id"
                  placeholder="Todas las cajas" [showClear]="true" />
      <p-dropdown class="filtro" [options]="conceptos()" [(ngModel)]="f.concepto_id" optionLabel="nombre" optionValue="id"
                  placeholder="Todos los conceptos" [showClear]="true" [filter]="true" filterBy="nombre" />
      <p-selectButton [options]="monedas" [(ngModel)]="f.moneda" optionLabel="etiqueta" optionValue="valor" />
      <span class="check"><p-checkbox [(ngModel)]="f.incluir_anulados" [binary]="true" inputId="anulados" />
        <label for="anulados">Con anulados</label></span>
      <p-button label="Consultar" icon="pi pi-search" [loading]="cargando()" (onClick)="consultar()" />
    </div>

    <ng-container *ngIf="libro() as l">
      <p class="titulo-libro">{{ l.titulo }}</p>
      <section class="totales">
        <div class="total"><span class="rotulo">Ingresos en efectivo</span><span class="monto ingreso">{{ l.totales.ingresos_efectivo | dinero: l.totales.moneda }}</span></div>
        <div class="total"><span class="rotulo">Egresos en efectivo</span><span class="monto egreso">{{ l.totales.egresos_efectivo | dinero: l.totales.moneda }}</span></div>
        <div class="total"><span class="rotulo">Neto en efectivo</span><span class="monto">{{ l.totales.neto_efectivo | dinero: l.totales.moneda }}</span></div>
        <div class="total"><span class="rotulo">Cheques y transferencias</span>
          <span class="monto secundario">+ {{ l.totales.ingresos_otras | dinero }} · − {{ l.totales.egresos_otras | dinero }}</span></div>
        <div class="total"><span class="rotulo">Movimientos</span><span class="monto">{{ l.totales.movimientos }}</span></div>
      </section>

      <div class="dos">
        <p-table [value]="l.movimientos" styleClass="p-datatable-sm tabla" [paginator]="l.movimientos.length > 50" [rows]="50">
          <ng-template pTemplate="header">
            <tr>
              <th style="width: 6.5rem">Fecha</th>
              <th style="width: 9.5rem">Comprobante</th>
              <th>Concepto · persona</th>
              <th style="width: 5.5rem">Forma</th>
              <th style="width: 7.5rem" class="derecha">Ingreso</th>
              <th style="width: 7.5rem" class="derecha">Egreso</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-m>
            <tr [class.anulado]="m.estado === 'ANULADO'">
              <td>{{ m.fecha | date: 'dd/MM/yy HH:mm' }}</td>
              <td><span class="codigo">{{ m.numero }}</span></td>
              <td>{{ m.concepto }}<div class="secundario">{{ m.persona }} · {{ m.glosa }}</div></td>
              <td>{{ m.forma_pago === 'EFECTIVO' ? 'Efectivo' : m.forma_pago === 'CHEQUE' ? 'Cheque' : 'Transf.' }}</td>
              <td class="derecha monto ingreso">{{ m.tipo === 'INGRESO' ? (m.monto | dinero) : '' }}</td>
              <td class="derecha monto egreso">{{ m.tipo === 'EGRESO' ? (m.monto | dinero) : '' }}</td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr><td colspan="6"><div class="vacio"><i class="pi pi-inbox"></i><div class="titulo-vacio">Sin movimientos en el período</div></div></td></tr>
          </ng-template>
        </p-table>

        <aside class="conceptos" *ngIf="l.por_concepto.length">
          <h3>Por concepto</h3>
          <div class="concepto" *ngFor="let c of l.por_concepto">
            <span>{{ c.concepto }} <span class="secundario">({{ c.movimientos }})</span></span>
            <span class="monto" [class.ingreso]="c.tipo === 'INGRESO'" [class.egreso]="c.tipo === 'EGRESO'">
              {{ c.tipo === 'INGRESO' ? '+' : '−' }} {{ c.total | dinero }}</span>
          </div>
        </aside>
      </div>
    </ng-container>
  `,
  styles: [...ESTILOS_CAJA, `
    .filtros { flex-wrap: wrap; gap: 0.6rem; align-items: flex-end; }
    .campo-fecha { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.75rem; }
    .check { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; }
    .titulo-libro { font-weight: 600; margin: 0 0 0.6rem; }
    .totales { display: flex; flex-wrap: wrap; gap: 0.8rem; margin-bottom: 1rem; }
    .total { display: flex; flex-direction: column; padding: 0.6rem 1rem; border: 1px solid var(--surface-border, #e5e7eb);
             border-radius: 8px; background: var(--surface-card, #fff); min-width: 11rem; }
    .total .rotulo { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-color-secondary, #6b7280); }
    .total .monto { font-size: 1.1rem; font-weight: 650; }
    .dos { display: grid; grid-template-columns: 1fr 18rem; gap: 1rem; align-items: start; }
    @media (max-width: 1500px) { .dos { grid-template-columns: 1fr; } .conceptos { order: -1; } }
    .conceptos { border: 1px solid var(--surface-border, #e5e7eb); border-radius: 8px; padding: 0.8rem 1rem; font-size: 0.85rem; }
    .conceptos h3 { margin: 0 0 0.5rem; font-size: 0.9rem; }
    .concepto { display: flex; justify-content: space-between; gap: 0.5rem; padding: 0.3rem 0;
                border-top: 1px solid var(--surface-border, #f1f5f9); }
    tr.anulado td { color: var(--text-color-secondary, #9ca3af); text-decoration: line-through; }
  `],
})
export class LibroCajaComponent implements OnInit {
  private readonly servicio = inject(CajaService);
  private readonly toast = inject(MessageService);

  readonly cajas = signal<Caja[]>([]);
  readonly conceptos = signal<Concepto[]>([]);
  readonly libro = signal<LibroCaja | null>(null);
  readonly cargando = signal(false);

  readonly monedas = [{ valor: 'BOB', etiqueta: 'Bs' }, { valor: 'USD', etiqueta: 'US$' }];

  f: FiltrosLibro = { desde: primeroDelMes(), hasta: hoy(), caja_id: null, concepto_id: null, moneda: 'BOB' as Moneda, incluir_anulados: false };

  ngOnInit(): void {
    this.servicio.listar().subscribe((c) => this.cajas.set(c));
    this.servicio.conceptos().subscribe((c) => this.conceptos.set(c));
    this.consultar();
  }

  consultar(): void {
    this.cargando.set(true);
    this.servicio.libro(this.f).subscribe({
      next: (l) => { this.libro.set(l); this.cargando.set(false); },
      error: (e) => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo consultar', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }

  archivo(formato: 'pdf' | 'excel'): void {
    this.servicio.libroArchivo(this.f, formato).subscribe({
      next: (b) => formato === 'pdf' ? abrirPdf(b) : descargar(b, `libro-de-caja-${this.f.desde}-a-${this.f.hasta}.xlsx`),
      error: () => this.toast.add({ severity: 'error', summary: 'No se pudo generar el archivo' }),
    });
  }
}

function primeroDelMes(): string {
  return hoy().slice(0, 8) + '01';
}
