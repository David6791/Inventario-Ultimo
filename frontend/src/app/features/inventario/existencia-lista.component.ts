import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin } from 'rxjs';
import { Categoria } from '../../core/models/catalogo.models';
import {
  ETIQUETA_STOCK, Existencia, FiltroExistencias, MARCA_STOCK, ResumenExistencias,
} from '../../core/models/existencia.models';
import { CatalogoService } from '../../core/services/catalogo.service';
import { ExistenciaService } from '../../core/services/existencia.service';
import { PermisosService } from '../../core/services/permisos.service';

@Component({
  selector: 'app-existencia-lista',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, DecimalPipe, TableModule, ButtonModule,
    InputTextModule, DropdownModule, TooltipModule,
  ],
  template: `
    <header class="pagina">
      <div>
        <h1>Existencias</h1>
        <p>Qué hay ahora en {{ permisos.almacenActivo()?.nombre }}. Se mueve solo
           con documentos: ingresos, salidas, transferencias y ajustes.</p>
      </div>
    </header>

    <!-- El resumen responde de un vistazo las tres preguntas de siempre. -->
    @if (resumen(); as r) {
      <div class="resumen">
        <div class="dato">
          <span class="numero">{{ r.con_saldo }}</span>
          <span class="rotulo">productos con saldo</span>
        </div>
        <div class="dato" [class.alerta]="r.bajo_minimo > 0">
          <span class="numero">{{ r.bajo_minimo }}</span>
          <span class="rotulo">bajo el mínimo</span>
        </div>
        <div class="dato" [class.critico]="r.agotados > 0">
          <span class="numero">{{ r.agotados }}</span>
          <span class="rotulo">agotados</span>
        </div>
        @if (r.valor !== null) {
          <div class="dato valor">
            <span class="numero">Bs {{ r.valor | number:'1.2-2' }}</span>
            <span class="rotulo">valor del inventario</span>
          </div>
        }
      </div>
    }

    <div class="filtros">
      <span class="p-input-icon-left crece">
        <i class="pi pi-search"></i>
        <input pInputText type="search" class="crece"
               placeholder="Código o nombre del producto"
               (input)="buscar($any($event.target).value)" />
      </span>

      <p-dropdown [options]="categorias()" [(ngModel)]="filtro.categoria_id"
                  optionLabel="nombre" optionValue="id" placeholder="Todas las categorías"
                  [showClear]="true" [filter]="true" (onChange)="cargar(0)" />

      <p-dropdown [options]="estados" [(ngModel)]="filtro.estado" optionLabel="etiqueta"
                  optionValue="valor" placeholder="Todos los estados"
                  [showClear]="true" (onChange)="cargar(0)" />
    </div>

    <p-table [value]="existencias()" [loading]="cargando()" [paginator]="true" [rows]="25"
             [totalRecords]="total()" [lazy]="true" (onLazyLoad)="cargar($event.first ?? 0)"
             dataKey="id" styleClass="p-datatable-sm">

      <ng-template pTemplate="header">
        <tr>
          <th style="width:10rem">Código</th>
          <th>Producto</th>
          <th style="width:13rem">Categoría</th>
          <th style="width:4.5rem">Unidad</th>
          <th style="width:8rem" class="cifra">Saldo</th>
          <th style="width:6rem" class="cifra">Mínimo</th>
          @if (veCostos()) {
            <th style="width:8rem" class="cifra">C. promedio</th>
            <th style="width:9rem" class="cifra">Valor</th>
          }
          <th style="width:4rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-e>
        <tr class="marca" [class]="marca(e)">
          <td><span class="codigo">{{ e.codigo }}</span></td>
          <td>
            <div class="nombre">{{ e.producto }}</div>
            @if (e.estado !== 'normal') {
              <div class="aviso-estado" [class]="'estado-' + e.estado">
                {{ etiqueta(e) }}
              </div>
            }
          </td>
          <td class="tenue">{{ e.categoria }}</td>
          <td><span class="codigo">{{ e.unidad }}</span></td>
          <td class="cifra saldo">{{ e.cantidad | number:'1.0-4' }}</td>
          <td class="cifra tenue">{{ e.stock_minimo | number:'1.0-4' }}</td>
          @if (veCostos()) {
            <td class="cifra tenue">{{ e.costo_promedio | number:'1.2-2' }}</td>
            <td class="cifra">{{ e.valor | number:'1.2-2' }}</td>
          }
          <td class="fila-acciones">
            <button pButton icon="pi pi-list" text rounded
                    [routerLink]="['/kardex', e.producto_id]"
                    pTooltip="Ver el kardex de este producto"></button>
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td [attr.colspan]="veCostos() ? 9 : 7">
          <div class="vacio">
            <i class="pi pi-database"></i>
            <p>No hay existencias que coincidan. Si el almacén está recién
               creado, registre un ingreso para que aparezca material.</p>
          </div>
        </td></tr>
      </ng-template>
    </p-table>
  `,
  styles: [`
    /* Cifras grandes arriba: son las tres preguntas que se hacen siempre. */
    .resumen { display:flex; gap:2.5rem; flex-wrap:wrap; padding:0 0 1.25rem;
               margin-bottom:1.25rem; border-bottom:1px solid var(--linea); }
    .dato { display:flex; flex-direction:column; gap:.125rem; }
    .dato .numero { font-size:1.5rem; font-weight:600; line-height:1.1;
                    font-variant-numeric:tabular-nums; letter-spacing:-0.02em; }
    .dato .rotulo { font-size:var(--t-xs); color:var(--tinta-suave); }
    .dato.alerta .numero { color:var(--aviso); }
    .dato.critico .numero { color:var(--alerta); }
    .dato.valor { margin-left:auto; text-align:right; }
    .dato.valor .numero { font-size:1.25rem; }

    .nombre { font-weight:500; }
    .aviso-estado { font-size:var(--t-xs); margin-top:.0625rem; }
    .aviso-estado.estado-agotado { color:var(--alerta); }
    .aviso-estado.estado-bajo { color:var(--aviso); }
    .aviso-estado.estado-exceso { color:var(--tinta-suave); }

    .saldo { font-weight:600; }
    .tenue { color:var(--tinta-suave); }
    .fila-acciones { text-align:right; }
  `],
})
export class ExistenciaListaComponent implements OnInit {
  private readonly servicio = inject(ExistenciaService);
  private readonly catalogo = inject(CatalogoService);
  private readonly ruta = inject(ActivatedRoute);
  readonly permisos = inject(PermisosService);

  readonly existencias = signal<Existencia[]>([]);
  readonly categorias = signal<Categoria[]>([]);
  readonly resumen = signal<ResumenExistencias | null>(null);
  readonly total = signal(0);
  readonly cargando = signal(false);

  readonly estados = [
    { etiqueta: 'Agotados', valor: 'agotado' },
    { etiqueta: 'Bajo el mínimo', valor: 'bajo' },
    { etiqueta: 'Con saldo normal', valor: 'normal' },
    { etiqueta: 'Sobre el máximo', valor: 'exceso' },
  ];

  filtro: FiltroExistencias = {};
  private temporizador?: ReturnType<typeof setTimeout>;

  veCostos(): boolean {
    return this.permisos.can('stock.ver-costos');
  }

  marca(e: Existencia): string {
    return MARCA_STOCK[e.estado] ?? '';
  }

  etiqueta(e: Existencia): string {
    return ETIQUETA_STOCK[e.estado] ?? '';
  }

  ngOnInit(): void {
    forkJoin({ categorias: this.catalogo.categorias(true) })
      .subscribe(({ categorias }) => this.categorias.set(categorias.data));

    /*
     | El filtro puede venir en la URL: el tablero enlaza acá con
     | ?estado=agotado. Sin leerlo, ese enlace llevaría a la lista completa y
     | el clic no serviría de nada.
     */
    this.ruta.queryParamMap.subscribe(parametros => {
      const estado = parametros.get('estado');

      if (estado === 'agotado' || estado === 'bajo'
          || estado === 'normal' || estado === 'exceso') {
        this.filtro.estado = estado;
      }

      const categoria = parametros.get('categoria_id');
      if (categoria) {
        this.filtro.categoria_id = Number(categoria);
      }

      this.cargar(0);
    });
  }

  cargar(desde = 0): void {
    this.cargando.set(true);

    this.servicio.listar(this.filtro, Math.floor(desde / 25) + 1).subscribe({
      next: res => {
        this.existencias.set(res.data);
        this.total.set(res.meta.total);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });

    // El resumen no depende de los filtros: son los totales del almacén.
    this.servicio.resumen().subscribe(r => this.resumen.set(r));
  }

  buscar(texto: string): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.filtro.buscar = texto;
      this.cargar(0);
    }, 300);
  }
}
