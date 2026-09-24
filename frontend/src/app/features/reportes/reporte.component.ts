import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin } from 'rxjs';
import { AlmacenCatalogo, Categoria } from '../../core/models/catalogo.models';
import {
  ColumnaReporte, ConfigReporte, FilaReporte, FiltroReporte, REPORTES,
  ResultadoReporte, TipoReporte,
} from '../../core/models/reporte.models';
import { CatalogoService } from '../../core/services/catalogo.service';
import { ReporteService } from '../../core/services/reporte.service';

/**
 * Una sola pantalla para los cuatro reportes.
 *
 * Las columnas llegan del servidor junto con los datos, así que agregar un
 * reporte nuevo no obliga a tocar el frontend: basta con una clase en el
 * backend y una entrada en REPORTES.
 */
@Component({
  selector: 'app-reporte',
  standalone: true,
  imports: [
    FormsModule, DecimalPipe, TableModule, ButtonModule, DropdownModule,
    CalendarModule, InputNumberModule, CheckboxModule, TooltipModule,
  ],
  template: `
    <header class="pagina">
      <div>
        <h1>{{ config().titulo }}</h1>
        <p>{{ config().descripcion }}</p>
      </div>
      <div class="acciones">
        <button pButton icon="pi pi-file-pdf" label="PDF" outlined
                [disabled]="!hayDatos()" [loading]="bajandoPdf()"
                (click)="descargar('pdf')"></button>
        <button pButton icon="pi pi-file-excel" label="Excel" outlined
                [disabled]="!hayDatos()" [loading]="bajandoExcel()"
                (click)="descargar('excel')"></button>
      </div>
    </header>

    <div class="filtros">
      @if (usa('almacen')) {
        <div class="campo-filtro">
          <label>Almacén</label>
          <p-dropdown [options]="almacenes()" [(ngModel)]="filtro.almacen_id"
                      optionLabel="nombre" optionValue="id"
                      placeholder="Todos los almacenes" [showClear]="true"
                      [filter]="true" appendTo="body" (onChange)="generar()" />
        </div>
      }

      @if (usa('categoria')) {
        <div class="campo-filtro">
          <label>Categoría</label>
          <p-dropdown [options]="categorias()" [(ngModel)]="filtro.categoria_id"
                      optionLabel="nombre" optionValue="id"
                      placeholder="Todas" [showClear]="true" [filter]="true"
                      appendTo="body" (onChange)="generar()" />
        </div>
      }

      @if (usa('estado')) {
        <div class="campo-filtro">
          <label>Estado</label>
          <p-dropdown [options]="estados" [(ngModel)]="filtro.estado"
                      optionLabel="etiqueta" optionValue="valor"
                      placeholder="Todos" [showClear]="true"
                      appendTo="body" (onChange)="generar()" />
        </div>
      }

      @if (usa('fechas')) {
        <div class="campo-filtro">
          <label>Desde</label>
          <p-calendar [(ngModel)]="desde" dateFormat="dd/mm/yy" [showIcon]="true"
                      [showClear]="true" appendTo="body"
                      (onSelect)="generar()" (onClear)="generar()" />
        </div>
        <div class="campo-filtro">
          <label>Hasta</label>
          <p-calendar [(ngModel)]="hasta" dateFormat="dd/mm/yy" [showIcon]="true"
                      [showClear]="true" appendTo="body"
                      (onSelect)="generar()" (onClear)="generar()" />
        </div>
      }

      @if (usa('tipo')) {
        <div class="campo-filtro">
          <label>Tipo</label>
          <p-dropdown [options]="tiposMovimiento" [(ngModel)]="filtro.tipo"
                      optionLabel="etiqueta" optionValue="valor"
                      placeholder="Todos" [showClear]="true"
                      appendTo="body" (onChange)="generar()" />
        </div>
      }

      @if (usa('dias')) {
        <div class="campo-filtro">
          <label>Vencen dentro de</label>
          <p-inputNumber [(ngModel)]="filtro.dias" [min]="1" [max]="3650"
                         suffix=" días" styleClass="dias"
                         (onBlur)="generar()" />
        </div>
      }

      @if (usa('sin_saldo')) {
        <label class="opcion">
          <p-checkbox [(ngModel)]="filtro.incluir_sin_saldo" [binary]="true"
                      (onChange)="generar()" />
          <span>Incluir productos sin saldo</span>
        </label>
      }
    </div>

    @if (resultado(); as r) {
      <!-- Los filtros aplicados quedan a la vista: sin ellos, la tabla no dice
           qué se consultó. El PDF y el Excel los llevan impresos. -->
      @if (objeto(r.filtros).length) {
        <div class="criterios">
          @for (f of objeto(r.filtros); track f[0]) {
            <span><span class="rotulo">{{ f[0] }}:</span> {{ f[1] }}</span>
          }
        </div>
      }

      <p-table [value]="r.filas" [loading]="cargando()" [paginator]="r.filas.length > 50"
               [rows]="50" dataKey="codigo" styleClass="p-datatable-sm"
               [scrollable]="true" scrollHeight="flex">

        <ng-template pTemplate="header">
          <tr>
            @for (c of r.columnas; track c.clave) {
              <th [class]="alineacion(c)"
                  [style.width]="c.ancho ? anchoPantalla(c) : null">
                {{ c.titulo }}
              </th>
            }
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-fila>
          <tr class="marca" [class]="marcaFila(fila)">
            @for (c of r.columnas; track c.clave) {
              <td [class]="clase(c, fila)">{{ formato(c, fila) }}</td>
            }
          </tr>
        </ng-template>

        @if (objeto(r.totales).length) {
          <ng-template pTemplate="footer">
            <tr class="totales">
              @for (c of r.columnas; track c.clave; let i = $index) {
                @if (r.totales[c.clave] !== undefined) {
                  <td [class]="alineacion(c)">
                    {{ r.totales[c.clave] | number: (c.tipo === 'moneda' ? '1.2-2' : '1.0-4') }}
                  </td>
                } @else if (i === indiceRotuloTotal(r)) {
                  <td class="rotulo-total">TOTAL</td>
                } @else {
                  <td></td>
                }
              }
            </tr>
          </ng-template>
        }

        <ng-template pTemplate="emptymessage">
          <tr><td [attr.colspan]="r.columnas.length">
            <div class="vacio">
              <i [class]="config().icono"></i>
              <p>{{ r.mensaje_vacio }}</p>
            </div>
          </td></tr>
        </ng-template>
      </p-table>

      @if (r.filas.length) {
        <p class="conteo">{{ r.filas.length }} registro(s)</p>
      }
    }
  `,
  styles: [`
    .filtros { align-items:flex-end; flex-wrap:wrap; }
    .campo-filtro { display:flex; flex-direction:column; gap:.3125rem; }
    .campo-filtro label { font-size:var(--t-xs); color:var(--tinta-suave); }
    :host ::ng-deep .campo-filtro p-dropdown { min-width:13rem; }
    :host ::ng-deep .dias input { width:8rem; text-align:right; }
    .opcion { display:flex; align-items:center; gap:.5rem; font-size:var(--t-sm);
              cursor:pointer; padding-bottom:.375rem; }

    /* Los criterios de la consulta, igual que en el PDF. */
    .criterios { display:flex; gap:1.5rem; flex-wrap:wrap; padding:.75rem 0;
                 margin-bottom:.75rem; border-bottom:1px solid var(--linea-tenue);
                 font-size:var(--t-sm); }
    .criterios .rotulo { font-size:var(--t-xs); color:var(--tinta-suave);
                         text-transform:uppercase; letter-spacing:.02em; }

    th.cantidad, th.moneda, th.entero,
    td.cantidad, td.moneda, td.entero { text-align:right;
                                        font-variant-numeric:tabular-nums; }
    th.fecha, td.fecha { text-align:center; }
    td.codigo { font-family:var(--mono); font-size:var(--t-xs); }

    tr.totales td { font-weight:600; border-top:2px solid var(--tinta);
                    background:var(--papel); }
    .rotulo-total { text-align:right; color:var(--tinta-suave);
                    font-weight:400; font-size:var(--t-sm); }

    /* Lo urgente se lee sin buscar. */
    td.vencido { color:var(--alerta); font-weight:600; }
    td.critico { color:var(--aviso); font-weight:600; }
    td.agotado { color:var(--alerta); }

    .conteo { font-size:var(--t-xs); color:var(--tinta-suave);
              margin:.75rem 0 0; }
  `],
})
export class ReporteComponent implements OnInit {
  private readonly servicio = inject(ReporteService);
  private readonly catalogo = inject(CatalogoService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly mensajes = inject(MessageService);

  readonly tipo = signal<TipoReporte>('existencias');
  readonly resultado = signal<ResultadoReporte | null>(null);
  readonly almacenes = signal<AlmacenCatalogo[]>([]);
  readonly categorias = signal<Categoria[]>([]);

  readonly cargando = signal(false);
  readonly bajandoPdf = signal(false);
  readonly bajandoExcel = signal(false);

  readonly config = computed<ConfigReporte>(() => {
    const tipo: TipoReporte = this.tipo();
    return REPORTES[tipo];
  });
  readonly hayDatos = computed(() => (this.resultado()?.filas.length ?? 0) > 0);

  filtro: FiltroReporte = {};
  desde: Date | null = null;
  hasta: Date | null = null;

  readonly estados = [
    { etiqueta: 'Agotados', valor: 'agotado' },
    { etiqueta: 'Bajo el mínimo', valor: 'bajo' },
  ];

  readonly tiposMovimiento = [
    { etiqueta: 'Ingresos', valor: 'ingreso' },
    { etiqueta: 'Salidas', valor: 'salida' },
    { etiqueta: 'Transferencias', valor: 'transferencia' },
  ];

  ngOnInit(): void {
    forkJoin({
      almacenes: this.catalogo.almacenes(true),
      categorias: this.catalogo.categorias(true),
    }).subscribe(({ almacenes, categorias }) => {
      this.almacenes.set(almacenes.data);
      this.categorias.set(categorias.data);
    });

    /*
     | El tipo llega como dato estático de la ruta: son cuatro entradas de menú
     | que reutilizan esta pantalla. Al cambiar de una a otra Angular reusa el
     | componente, así que hay que escuchar el cambio y no leerlo una sola vez.
     */
    this.ruta.data.subscribe(datos => {
      const tipo = (datos['tipo'] as TipoReporte) ?? 'existencias';

      if (tipo === this.tipo() && this.resultado()) return;

      this.tipo.set(tipo);
      this.reiniciarFiltros();
      this.generar();
    });
  }

  /** Cada reporte arranca con sus valores razonables, no con los del anterior. */
  /** Cada reporte arranca con sus valores razonables, no con los del anterior. */
  private reiniciarFiltros(): void {
    this.filtro = {};
    this.desde = null;
    this.hasta = null;

    if (this.tipo() === 'vencimientos') {
      this.filtro.dias = 90;
    }

    if (this.esPorPeriodo()) {
      // Por defecto, el mes en curso: pedir todo el histórico sin filtro es
      // lento y casi nunca es lo que se quiere.
      this.desde = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      this.hasta = new Date();
    }
  }
  /** Reportes que miden un período, no un saldo al momento. */
  private esPorPeriodo(): boolean {
    return ['movimientos', 'consumo-areas', 'consumo-solicitantes', 'consumo-productos']
      .includes(this.tipo());
  }

  usa(filtro: string): boolean {
    return this.config().filtros.includes(filtro as never);
  }

  objeto(registro: Record<string, unknown>): Array<[string, unknown]> {
    return Object.entries(registro ?? {});
  }

  generar(): void {
    this.cargando.set(true);

    this.servicio.generar(this.tipo(), this.filtroCompleto()).subscribe({
      next: r => {
        this.resultado.set(r);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  descargar(formato: 'pdf' | 'excel'): void {
    const bandera = formato === 'pdf' ? this.bajandoPdf : this.bajandoExcel;
    bandera.set(true);

    const peticion = formato === 'pdf'
      ? this.servicio.descargarPdf(this.tipo(), this.filtroCompleto())
      : this.servicio.descargarExcel(this.tipo(), this.filtroCompleto());

    peticion.subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);

        if (formato === 'pdf') {
          window.open(url, '_blank');
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } else {
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = `${this.tipo()}-${this.marcaTiempo()}.xlsx`;
          enlace.click();
          URL.revokeObjectURL(url);
        }

        bandera.set(false);
      },
      error: () => {
        bandera.set(false);
        this.mensajes.add({
          severity: 'error',
          summary: 'No se pudo generar el archivo',
          detail: 'Intente nuevamente o reduzca el rango de fechas.',
        });
      },
    });
  }

  private filtroCompleto(): FiltroReporte {
    return {
      ...this.filtro,
      desde: this.desde ? this.aIso(this.desde) : null,
      hasta: this.hasta ? this.aIso(this.hasta) : null,
    };
  }

  // --- Presentación de la tabla ------------------------------------------

  alineacion(columna: ColumnaReporte): string {
    return columna.tipo ?? 'texto';
  }

  anchoPantalla(columna: ColumnaReporte): string {
    // Los anchos del PDF están en milímetros; en pantalla se aproximan.
    const mm = parseFloat(columna.ancho ?? '0');
    return mm ? `${Math.round(mm * 0.38)}rem` : 'auto';
  }

  clase(columna: ColumnaReporte, fila: FilaReporte): string {
    let clase = this.alineacion(columna);

    if (columna.clave === 'codigo' || columna.clave === 'lote') {
      clase += ' codigo';
    }

    if (columna.clave === 'situacion') {
      if (fila['situacion'] === 'VENCIDO') clase += ' vencido';
      else if (fila['situacion'] === 'Crítico') clase += ' critico';
    }

    if (columna.clave === 'estado' && fila['estado'] === 'Agotado') {
      clase += ' agotado';
    }

    return clase;
  }

  marcaFila(fila: FilaReporte): string {
    if (fila['situacion'] === 'VENCIDO' || fila['estado'] === 'Agotado') {
      return 'marca-agotado';
    }

    if (fila['situacion'] === 'Crítico' || fila['estado'] === 'Bajo mínimo') {
      return 'marca-bajo';
    }

    return '';
  }

  formato(columna: ColumnaReporte, fila: FilaReporte): string {
    const valor = fila[columna.clave];

    if (valor === null || valor === undefined || valor === '') return '';

    switch (columna.tipo) {
      case 'moneda':
        return Number(valor).toLocaleString('es-BO', {
          minimumFractionDigits: 2, maximumFractionDigits: 2,
        });
      case 'cantidad':
        return Number(valor).toLocaleString('es-BO', { maximumFractionDigits: 4 });
      case 'entero':
        return Number(valor).toLocaleString('es-BO', { maximumFractionDigits: 0 });
      default:
        return String(valor);
    }
  }

  /** Dónde poner el rótulo TOTAL: en la celda anterior a la primera cifra. */
  indiceRotuloTotal(r: ResultadoReporte): number {
    const primera = r.columnas.findIndex(c => r.totales[c.clave] !== undefined);
    return primera > 0 ? primera - 1 : -1;
  }

  private aIso(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  private marcaTiempo(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
