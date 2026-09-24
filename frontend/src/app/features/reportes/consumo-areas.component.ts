import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TooltipModule } from 'primeng/tooltip';
import {
  ConsumoPorArea, FiltroConsumo, RespuestaConsumo,
} from '../../core/models/consumo.models';
import { ReporteConsumoService, VistaConsumo } from '../../core/services/reporte-consumo.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-consumo-areas',
  standalone: true,
  imports: [
    FormsModule, DecimalPipe, TableModule, TabViewModule, ButtonModule,
    DropdownModule, CalendarModule, TooltipModule, TienePermisoDirective,
  ],
  template: `
    <header class="pagina">
      <div>
        <h1>Consumo por área</h1>
        <p>Cuánto consumió cada unidad en el periodo, valorizado al costo real
           de las capas que salieron. Neto de devoluciones.</p>
      </div>
    </header>

    <div class="filtros">
      <p-calendar [(ngModel)]="desde" dateFormat="dd/mm/yy" placeholder="Desde"
                  [showIcon]="true" (onSelect)="consultar()" />

      <p-calendar [(ngModel)]="hasta" dateFormat="dd/mm/yy" placeholder="Hasta"
                  [showIcon]="true" [maxDate]="hoy" (onSelect)="consultar()" />

      <p-dropdown [options]="periodos" [(ngModel)]="periodoRapido" optionLabel="etiqueta"
                  optionValue="valor" placeholder="Periodo rápido"
                  (onChange)="aplicarPeriodo()" />

      <span class="separador"></span>

      <button pButton icon="pi pi-file-pdf" label="PDF" outlined
              [loading]="descargando() === 'pdf'" (click)="descargar('pdf')"></button>
      <button pButton icon="pi pi-file-excel" label="Excel" outlined
              [loading]="descargando() === 'excel'" (click)="descargar('excel')"></button>
    </div>

    @if (datos(); as d) {
      <div class="totales">
        <div class="total">
          <span class="rotulo">Salidas</span>
          <strong class="importe">{{ d.totales.costo_salida | number:'1.2-2' }}</strong>
          <span class="unidad-medida">Bs</span>
        </div>
        <div class="total">
          <span class="rotulo">Devoluciones</span>
          <strong class="importe resta">
            @if (d.totales.costo_devolucion > 0) { − }
            {{ d.totales.costo_devolucion | number:'1.2-2' }}
          </strong>
          <span class="unidad-medida">Bs</span>
        </div>
        <div class="total destacado">
          <span class="rotulo">Consumo neto</span>
          <strong class="importe">{{ d.totales.costo_neto | number:'1.2-2' }}</strong>
          <span class="unidad-medida">Bs</span>
        </div>
        <div class="total">
          <span class="rotulo">Áreas / salidas</span>
          <strong>{{ d.totales.unidades }} / {{ d.totales.salidas }}</strong>
        </div>
      </div>

      <p-tabView [(activeIndex)]="pestana">

        <!-- Por área -->
        <p-tabPanel header="Por área">
          <p-table [value]="d.areas" [loading]="cargando()" dataKey="unidad_id"
                   styleClass="p-datatable-sm" sortField="costo_neto" [sortOrder]="-1">
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="unidad">Unidad solicitante <p-sortIcon field="unidad" /></th>
                <th style="width:6rem" class="cifra">Solic.</th>
                <th style="width:6rem" class="cifra">Salidas</th>
                <th style="width:9rem" class="cifra">Salidas Bs</th>
                <th style="width:9rem" class="cifra">Devol. Bs</th>
                <th style="width:10rem" class="cifra" pSortableColumn="costo_neto">
                  Neto Bs <p-sortIcon field="costo_neto" />
                </th>
                <th style="width:5rem" class="cifra">%</th>
                <th style="width:7rem" class="cifra">Var.</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-a>
              <tr class="clicable" (click)="verSolicitantes(a)">
                <td>{{ a.unidad }}</td>
                <td class="cifra tenue">{{ a.solicitantes }}</td>
                <td class="cifra tenue">{{ a.salidas }}</td>
                <td class="cifra importe tenue">{{ a.costo_salida | number:'1.2-2' }}</td>
                <td class="cifra importe tenue">
                  @if (a.costo_devolucion > 0) {
                    <span class="resta">−{{ a.costo_devolucion | number:'1.2-2' }}</span>
                  } @else { — }
                </td>
                <td class="cifra importe"><strong>{{ a.costo_neto | number:'1.2-2' }}</strong></td>
                <td class="cifra">
                  <span class="barra" [style.--p.%]="a.participacion"></span>
                  {{ a.participacion | number:'1.1-1' }}
                </td>
                <td class="cifra">
                  @if (a.variacion_porcentaje === null) {
                    <span class="tenue" pTooltip="No hubo consumo en el periodo anterior">nuevo</span>
                  } @else {
                    <span [class]="a.variacion >= 0 ? 'sube' : 'baja'">
                      {{ a.variacion >= 0 ? '↑' : '↓' }}
                      {{ abs(a.variacion_porcentaje) | number:'1.0-1' }}%
                    </span>
                  }
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="emptymessage">
              <tr><td colspan="8">
                <div class="vacio">
                  <i class="pi pi-chart-bar"></i>
                  <p>No hubo consumo en el periodo seleccionado.</p>
                </div>
              </td></tr>
            </ng-template>
          </p-table>

          <p class="nota">Haga clic en un área para ver el detalle por solicitante.</p>
        </p-tabPanel>

        <!-- Por solicitante -->
        <p-tabPanel header="Por solicitante">
          @if (unidadFiltrada()) {
            <div class="filtro-activo">
              Mostrando solo <strong>{{ unidadFiltrada() }}</strong>
              <button pButton icon="pi pi-times" text rounded size="small"
                      (click)="limpiarUnidad()" pTooltip="Ver todas las áreas"></button>
            </div>
          }

          <p-table [value]="solicitantesVisibles()" [loading]="cargando()"
                   dataKey="solicitante_id" styleClass="p-datatable-sm">
            <ng-template pTemplate="header">
              <tr>
                <th>Solicitante</th>
                <th>Unidad</th>
                <th style="width:6rem" class="cifra">Salidas</th>
                <th style="width:9rem" class="cifra">Salidas Bs</th>
                <th style="width:9rem" class="cifra">Devol. Bs</th>
                <th style="width:10rem" class="cifra">Neto Bs</th>
                <th style="width:5rem" class="cifra">%</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-s>
              <tr>
                <td>{{ s.solicitante }}</td>
                <td class="tenue">{{ s.unidad }}</td>
                <td class="cifra tenue">{{ s.salidas }}</td>
                <td class="cifra importe tenue">{{ s.costo_salida | number:'1.2-2' }}</td>
                <td class="cifra importe tenue">
                  @if (s.costo_devolucion > 0) {
                    <span class="resta">−{{ s.costo_devolucion | number:'1.2-2' }}</span>
                  } @else { — }
                </td>
                <td class="cifra importe"><strong>{{ s.costo_neto | number:'1.2-2' }}</strong></td>
                <td class="cifra">{{ s.participacion | number:'1.1-1' }}</td>
              </tr>
            </ng-template>
          </p-table>
        </p-tabPanel>

        <!-- Por producto -->
        <p-tabPanel header="Por producto">
          <p-table [value]="d.productos" [loading]="cargando()" dataKey="producto_id"
                   styleClass="p-datatable-sm" [paginator]="true" [rows]="25">
            <ng-template pTemplate="header">
              <tr>
                <th style="width:9rem">Código</th>
                <th>Producto</th>
                <th style="width:12rem">Categoría</th>
                <th style="width:6rem" class="cifra" pTooltip="Cuántas áreas lo pidieron">Áreas</th>
                <th style="width:8rem" class="cifra">Cantidad</th>
                <th style="width:9rem" class="cifra">Costo unit.</th>
                <th style="width:10rem" class="cifra">Costo Bs</th>
                <th style="width:5rem" class="cifra">%</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-p>
              <tr>
                <td><span class="codigo">{{ p.producto_codigo }}</span></td>
                <td>{{ p.producto }}</td>
                <td class="tenue">{{ p.categoria ?? '—' }}</td>
                <td class="cifra tenue">{{ p.unidades }}</td>
                <td class="cifra">{{ p.cantidad_neta | number:'1.0-4' }}</td>
                <td class="cifra importe tenue">{{ p.costo_unitario_promedio | number:'1.2-4' }}</td>
                <td class="cifra importe"><strong>{{ p.costo_neto | number:'1.2-2' }}</strong></td>
                <td class="cifra">{{ p.participacion | number:'1.1-1' }}</td>
              </tr>
            </ng-template>
          </p-table>

          <p class="nota">
            El costo unitario es el promedio ponderado de las capas PEPS consumidas
            en el periodo, no el precio de la última compra.
          </p>
        </p-tabPanel>
      </p-tabView>
    }
  `,
  styles: [`
    .separador { flex:1; }

    .totales { display:flex; gap:2rem; padding:.875rem 1.125rem; margin-bottom:1rem;
               border:1px solid var(--linea); border-radius:3px; }
    .total { display:flex; flex-direction:column; gap:.125rem; }
    .total.destacado .importe { font-size:var(--t-lg); }
    .rotulo { font-size:var(--t-xs); color:var(--tinta-suave); }
    .unidad-medida { font-size:var(--t-xs); color:var(--tinta-tenue); }

    .importe { font-variant-numeric:tabular-nums; }
    .resta { color:var(--tinta-suave); }
    .tenue { color:var(--tinta-suave); }

    .sube { color:var(--alerta); }
    .baja { color:var(--bien); }

    /* Barra de participación: contexto visual sin ocupar una columna aparte. */
    .barra { display:block; height:2px; width:100%; margin-bottom:.1875rem;
             background:linear-gradient(to right,
               var(--tinta-suave) var(--p), transparent var(--p)); }

    tr.clicable { cursor:pointer; }
    tr.clicable:hover { background:var(--fondo-suave); }

    .filtro-activo { display:flex; align-items:center; gap:.5rem;
                     margin-bottom:.75rem; font-size:var(--t-sm); }

    .nota { margin:.875rem 0 0; font-size:var(--t-xs); color:var(--tinta-suave); }
  `],
})
export class ConsumoAreasComponent implements OnInit {
  private readonly servicio = inject(ReporteConsumoService);

  readonly datos = signal<RespuestaConsumo | null>(null);
  readonly cargando = signal(false);
  readonly descargando = signal<'pdf' | 'excel' | null>(null);
  readonly unidadFiltrada = signal<string | null>(null);

  readonly hoy = new Date();
  pestana = 0;
  periodoRapido = 'mes';

  desde: Date = this.inicioDeMes();
  hasta: Date = new Date();

  readonly periodos = [
    { etiqueta: 'Este mes', valor: 'mes' },
    { etiqueta: 'Mes anterior', valor: 'mes_anterior' },
    { etiqueta: 'Este trimestre', valor: 'trimestre' },
    { etiqueta: 'Esta gestión', valor: 'gestion' },
  ];

  /** El drill-down de área filtra esta lista sin volver a consultar el backend. */
  readonly solicitantesVisibles = computed(() => {
    const todos = this.datos()?.solicitantes ?? [];
    const unidad = this.unidadFiltrada();

    return unidad ? todos.filter(s => s.unidad === unidad) : todos;
  });

  ngOnInit(): void {
    this.consultar();
  }

  abs(valor: number): number {
    return Math.abs(valor);
  }

  consultar(): void {
    this.cargando.set(true);

    this.servicio.consultar(this.filtro()).subscribe({
      next: res => {
        this.datos.set(res);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  verSolicitantes(area: ConsumoPorArea): void {
    this.unidadFiltrada.set(area.unidad);
    this.pestana = 1;
  }

  limpiarUnidad(): void {
    this.unidadFiltrada.set(null);
  }

  aplicarPeriodo(): void {
    const hoy = new Date();

    switch (this.periodoRapido) {
      case 'mes':
        this.desde = this.inicioDeMes();
        this.hasta = hoy;
        break;

      case 'mes_anterior':
        this.desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        this.hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        break;

      case 'trimestre': {
        const mesInicio = Math.floor(hoy.getMonth() / 3) * 3;
        this.desde = new Date(hoy.getFullYear(), mesInicio, 1);
        this.hasta = hoy;
        break;
      }

      case 'gestion':
        this.desde = new Date(hoy.getFullYear(), 0, 1);
        this.hasta = hoy;
        break;
    }

    this.consultar();
  }

  descargar(formato: 'pdf' | 'excel'): void {
    this.descargando.set(formato);

    const vistas: VistaConsumo[] = ['area', 'solicitante', 'producto'];
    const vista = vistas[this.pestana] ?? 'area';

    // responseType blob: sin esto el binario se corrompe al tratarse como texto.
    this.servicio.descargar(this.filtro(), vista, formato).subscribe({
      next: blob => {
        const extension = formato === 'pdf' ? 'pdf' : 'xlsx';
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');

        enlace.href = url;
        enlace.download = `consumo-${vista}-${this.iso(this.desde)}.${extension}`;
        enlace.click();

        URL.revokeObjectURL(url);
        this.descargando.set(null);
      },
      error: () => this.descargando.set(null),
    });
  }

  private filtro(): FiltroConsumo {
    return {
      desde: this.iso(this.desde),
      hasta: this.iso(this.hasta),
    };
  }

  private inicioDeMes(): Date {
    const hoy = new Date();

    return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }

  private iso(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
  }
}
