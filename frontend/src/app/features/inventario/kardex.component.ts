import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { PanelModule } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin } from 'rxjs';
import {
  CapaCosto, EncabezadoKardex, FiltroKardex, MovimientoKardex,
} from '../../core/models/existencia.models';
import { ExistenciaService } from '../../core/services/existencia.service';
import { PermisosService } from '../../core/services/permisos.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-kardex',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, DecimalPipe, TableModule, ButtonModule,
    CalendarModule, PanelModule, TooltipModule, TienePermisoDirective,
  ],
  template: `
    @if (encabezado(); as k) {
      <header class="pagina">
        <div>
          <h1><span class="codigo">{{ k.codigo }}</span> {{ k.producto }}</h1>
          <p>Movimientos en {{ permisos.almacenActivo()?.nombre }}. El histórico
             no se altera: una anulación escribe un movimiento inverso.</p>
        </div>
        <div class="acciones">
          <button pButton label="Volver" severity="secondary" text
                  routerLink="/existencias"></button>
          <button pButton icon="pi pi-download" label="Exportar" outlined
                  *appTienePermiso="'kardex.exportar'"
                  [loading]="exportando()" (click)="exportar()"></button>
        </div>
      </header>

      <div class="saldo-actual">
        <div class="dato">
          <span class="numero">{{ k.saldo | number:'1.0-4' }}</span>
          <span class="rotulo">{{ k.unidad }} en existencia</span>
        </div>
        @if (k.costo_promedio !== null) {
          <div class="dato">
            <span class="numero">Bs {{ k.costo_promedio | number:'1.2-2' }}</span>
            <span class="rotulo">costo promedio</span>
          </div>
          <div class="dato">
            <span class="numero">Bs {{ k.saldo * k.costo_promedio | number:'1.2-2' }}</span>
            <span class="rotulo">valor en existencia</span>
          </div>
        }
      </div>

      <!-- Las capas explican el costo mejor que el promedio: dicen a qué
           precio va a salir lo próximo. -->
      @if (capas().length) {
        <p-panel header="Capas de costo (PEPS)" [toggleable]="true" [collapsed]="true">
          <p class="nota">Las salidas consumen estas capas de arriba hacia abajo.
             La más antigua es la que sale primero.</p>

          <p-table [value]="capas()" dataKey="id" styleClass="p-datatable-sm">
            <ng-template pTemplate="header">
              <tr>
                <th style="width:9rem">Ingresó</th>
                <th style="width:8rem" class="cifra">Entró</th>
                <th style="width:8rem" class="cifra">Queda</th>
                @if (veCostos()) {
                  <th style="width:8rem" class="cifra">C. unitario</th>
                  <th style="width:9rem" class="cifra">Valor</th>
                }
                <th>Lote / vencimiento</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-c let-i="rowIndex">
              <tr [class.primera]="i === 0">
                <td>{{ c.fecha | date:'dd/MM/yyyy' }}</td>
                <td class="cifra tenue">{{ c.cantidad_inicial | number:'1.0-4' }}</td>
                <td class="cifra">{{ c.cantidad_restante | number:'1.0-4' }}</td>
                @if (veCostos()) {
                  <td class="cifra">{{ c.costo_unitario | number:'1.2-2' }}</td>
                  <td class="cifra">{{ c.valor | number:'1.2-2' }}</td>
                }
                <td class="tenue">
                  @if (c.lote) { <span class="codigo">{{ c.lote }}</span> }
                  @if (c.fecha_vencimiento) {
                    <span class="vence">vence {{ c.fecha_vencimiento | date:'dd/MM/yy' }}</span>
                  }
                  @if (!c.lote && !c.fecha_vencimiento) { — }
                </td>
              </tr>
            </ng-template>
          </p-table>
        </p-panel>
      }

      <div class="filtros">
        <div class="campo-fecha">
          <label>Desde</label>
          <p-calendar [(ngModel)]="desde" dateFormat="dd/mm/yy" [showIcon]="true"
                      [showClear]="true" appendTo="body" (onSelect)="cargar(0)"
                      (onClear)="cargar(0)" />
        </div>
        <div class="campo-fecha">
          <label>Hasta</label>
          <p-calendar [(ngModel)]="hasta" dateFormat="dd/mm/yy" [showIcon]="true"
                      [showClear]="true" appendTo="body" (onSelect)="cargar(0)"
                      (onClear)="cargar(0)" />
        </div>
      </div>

      <p-table [value]="movimientos()" [loading]="cargando()" [paginator]="true" [rows]="30"
               [totalRecords]="total()" [lazy]="true" (onLazyLoad)="cargar($event.first ?? 0)"
               dataKey="id" styleClass="p-datatable-sm">

        <ng-template pTemplate="header">
          <tr>
            <th style="width:9.5rem">Fecha</th>
            <th style="width:13rem">Documento</th>
            <th>Detalle</th>
            <th style="width:7rem" class="cifra">Entrada</th>
            <th style="width:7rem" class="cifra">Salida</th>
            <th style="width:8rem" class="cifra">Saldo</th>
            @if (veCostos()) {
              <th style="width:8rem" class="cifra">C. unit.</th>
            }
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-m>
          <tr class="marca" [class.anulacion]="esAnulacion(m)"
              [class.marca-bajo]="esAnulacion(m)">
            <td class="tenue">{{ m.fecha | date:'dd/MM/yy HH:mm' }}</td>
            <td><span class="codigo">{{ m.documento_numero }}</span></td>
            <td>
              <div>{{ m.documento_etiqueta }}</div>
              @if (m.observacion) {
                <div class="observacion">{{ m.observacion }}</div>
              }
            </td>
            <td class="cifra entrada">
              {{ m.entrada > 0 ? (m.entrada | number:'1.0-4') : '' }}
            </td>
            <td class="cifra salida">
              {{ m.salida > 0 ? (m.salida | number:'1.0-4') : '' }}
            </td>
            <td class="cifra saldo">{{ m.saldo | number:'1.0-4' }}</td>
            @if (veCostos()) {
              <td class="cifra tenue">{{ m.costo_unitario | number:'1.2-2' }}</td>
            }
          </tr>
        </ng-template>

        <ng-template pTemplate="emptymessage">
          <tr><td [attr.colspan]="veCostos() ? 7 : 6">
            <div class="vacio">
              <i class="pi pi-list"></i>
              <p>Este producto no registra movimientos en el período consultado.</p>
            </div>
          </td></tr>
        </ng-template>
      </p-table>
    }
  `,
  styles: [`
    .pagina h1 { font-size:var(--t-md); }
    .pagina h1 .codigo { color:var(--tinta-suave); margin-right:.5rem; }

    .saldo-actual { display:flex; gap:2.5rem; padding:0 0 1.25rem;
                    margin-bottom:1.25rem; border-bottom:1px solid var(--linea); }
    .dato { display:flex; flex-direction:column; gap:.125rem; }
    .dato .numero { font-size:1.5rem; font-weight:600; line-height:1.1;
                    font-variant-numeric:tabular-nums; letter-spacing:-0.02em; }
    .dato .rotulo { font-size:var(--t-xs); color:var(--tinta-suave); }

    .filtros { align-items:flex-end; }
    .campo-fecha { display:flex; flex-direction:column; gap:.3125rem; }
    .campo-fecha label { font-size:var(--t-xs); color:var(--tinta-suave); }

    /* La capa más antigua es la próxima en salir: se destaca. */
    tr.primera td { background:var(--acento-lavado); font-weight:500; }

    .entrada { color:var(--bien); }
    .salida { color:var(--alerta); }
    .saldo { font-weight:600; background:var(--linea-tenue); }
    .observacion { font-size:var(--t-xs); color:var(--tinta-suave); }
    .vence { font-size:var(--t-xs); margin-left:.5rem; }
    .tenue { color:var(--tinta-suave); }
    tr.anulacion td { font-style:italic; color:var(--tinta-suave); }

    .nota { font-size:var(--t-sm); color:var(--tinta-suave); margin:0 0 .875rem;
            line-height:1.5; max-width:70ch; }
    :host ::ng-deep p-panel { display:block; margin-bottom:1.25rem; }
  `],
})
export class KardexComponent implements OnInit {
  private readonly servicio = inject(ExistenciaService);
  readonly permisos = inject(PermisosService);

  /** Llega por la ruta /kardex/:productoId */
  readonly productoId = input.required<string>();

  readonly encabezado = signal<EncabezadoKardex | null>(null);
  readonly movimientos = signal<MovimientoKardex[]>([]);
  readonly capas = signal<CapaCosto[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly exportando = signal(false);

  desde: Date | null = null;
  hasta: Date | null = null;

  veCostos(): boolean {
    return this.permisos.can('stock.ver-costos');
  }

  esAnulacion(m: MovimientoKardex): boolean {
    return m.documento_tipo.includes('anulacion');
  }

  ngOnInit(): void {
    const id = Number(this.productoId());

    forkJoin({
      encabezado: this.servicio.encabezadoKardex(id),
      detalle: this.servicio.detalle(id),
    }).subscribe({
      next: ({ encabezado, detalle }) => {
        this.encabezado.set(encabezado);
        this.capas.set(detalle.capas);
      },
      // Un producto sin existencias no tiene fila en `existencias`, pero sí
      // puede tener kardex: el encabezado alcanza para mostrar la pantalla.
      error: () => {
        this.servicio.encabezadoKardex(id)
          .subscribe(encabezado => this.encabezado.set(encabezado));
      },
    });

    this.cargar(0);
  }

  cargar(desde = 0): void {
    this.cargando.set(true);

    this.servicio.kardex(
      Number(this.productoId()), this.filtro(), Math.floor(desde / 30) + 1,
    ).subscribe({
      next: res => {
        this.movimientos.set(res.data);
        this.total.set(res.meta.total);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  exportar(): void {
    this.exportando.set(true);

    this.servicio.descargarKardex(Number(this.productoId()), this.filtro()).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        this.exportando.set(false);
      },
      error: () => this.exportando.set(false),
    });
  }

  private filtro(): FiltroKardex {
    return {
      desde: this.desde ? this.aIso(this.desde) : undefined,
      hasta: this.hasta ? this.aIso(this.hasta) : undefined,
    };
  }

  private aIso(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }
}
