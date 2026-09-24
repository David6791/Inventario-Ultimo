import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { forkJoin } from 'rxjs';
import { Categoria, Producto } from '../../core/models/catalogo.models';
import { CatalogoService, FiltroProductos } from '../../core/services/catalogo.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-producto-lista',
  standalone: true,
  imports: [
    RouterLink, FormsModule, TableModule, ButtonModule, InputTextModule,
    DropdownModule, TooltipModule, TienePermisoDirective,
  ],
  template: `
    <header class="pagina">
      <div>
        <h1>Productos</h1>
        <p>El catálogo define qué se puede mover. Las existencias de cada
           almacén se ven en Inventario.</p>
      </div>
      <div class="acciones">
        <button pButton routerLink="/productos/importar" icon="pi pi-file-excel"
                label="Importar" outlined
                pTooltip="Cargar varios productos desde una planilla de Excel"
                *appTienePermiso="'productos.crear'"></button>
        <button pButton routerLink="/productos/nuevo" icon="pi pi-plus"
                label="Registrar producto" *appTienePermiso="'productos.crear'"></button>
      </div>
    </header>

    <div class="filtros">
      <span class="p-input-icon-left crece">
        <i class="pi pi-search"></i>
        <input pInputText type="search" class="crece"
               placeholder="Código, nombre o código de barras"
               (input)="buscar($any($event.target).value)" />
      </span>

      <p-dropdown [options]="categorias()" [(ngModel)]="filtro.categoria_id"
                  optionLabel="nombre" optionValue="id" placeholder="Todas las categorías"
                  [showClear]="true" [filter]="true" (onChange)="cargar(0)" />

      <p-dropdown [options]="estados" [(ngModel)]="filtro.activo"
                  optionLabel="etiqueta" optionValue="valor" placeholder="Activos e inactivos"
                  [showClear]="true" (onChange)="cargar(0)" />
    </div>

    <p-table [value]="productos()" [loading]="cargando()" [paginator]="true" [rows]="20"
             [totalRecords]="total()" [lazy]="true" (onLazyLoad)="cargar($event.first ?? 0)"
             dataKey="id" styleClass="p-datatable-sm">

      <ng-template pTemplate="header">
        <tr>
          <th style="width:11rem">Código</th>
          <th>Producto</th>
          <th style="width:13rem">Categoría</th>
          <th style="width:5rem">Unidad</th>
          <th style="width:7rem" class="cifra">Mínimo</th>
          <th style="width:8rem">Control</th>
          <th style="width:6rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-producto>
        <tr class="marca" [class.marca-inactivo]="!producto.activo"
            [class.atenuada]="!producto.activo">
          <td><span class="codigo">{{ producto.codigo }}</span></td>

          <td>
            <div class="nombre">
              {{ producto.nombre }}
              @if (!producto.activo) { <span class="baja">dado de baja</span> }
            </div>
            @if (producto.partida_presupuestaria) {
              <div class="partida">Partida {{ producto.partida_presupuestaria }}</div>
            }
          </td>

          <td>{{ producto.categoria }}</td>
          <td><span class="codigo">{{ producto.unidad }}</span></td>
          <td class="cifra">{{ producto.stock_minimo }}</td>

          <td class="control">
            @if (producto.controla_lote) { <span pTooltip="Pide número de lote al ingresar">Lote</span> }
            @if (producto.controla_vencimiento) { <span pTooltip="Pide fecha de vencimiento al ingresar">Vence</span> }
            @if (!producto.controla_lote && !producto.controla_vencimiento) { <span class="ninguno">—</span> }
          </td>

          <td class="fila-acciones">
            <button pButton icon="pi pi-pencil" text rounded
                    [routerLink]="['/productos', producto.id]" pTooltip="Editar"></button>
            <button pButton text rounded
                    *appTienePermiso="'productos.eliminar'"
                    [icon]="producto.activo ? 'pi pi-ban' : 'pi pi-check-circle'"
                    [severity]="producto.activo ? 'danger' : 'success'"
                    [pTooltip]="producto.activo ? 'Dar de baja' : 'Reactivar'"
                    (click)="cambiarEstado(producto)"></button>
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="7">
          <div class="vacio">
            <i class="pi pi-box"></i>
            <p>Ningún producto coincide con la búsqueda. Pruebe con parte del
               nombre, o quite los filtros.</p>
          </div>
        </td></tr>
      </ng-template>
    </p-table>
  `,
  styles: [`
    .nombre { font-weight:500; }
    .baja { font-size:var(--t-xs); font-weight:400; color:var(--tinta-tenue);
            margin-left:.5rem; }
    .partida { font-size:var(--t-xs); color:var(--tinta-suave);
               font-family:var(--fuente-codigo); }
    .control { font-size:var(--t-xs); }
    .control span { display:inline-block; padding:.0625rem .375rem; margin-right:.25rem;
                    border:1px solid var(--linea); border-radius:2px;
                    color:var(--tinta-suave); }
    .control .ninguno { border:0; padding:0; }
    .fila-acciones { text-align:right; white-space:nowrap; }
  `],
})
export class ProductoListaComponent implements OnInit {
  private readonly servicio = inject(CatalogoService);
  private readonly mensajes = inject(MessageService);
  private readonly confirmar = inject(ConfirmationService);

  readonly productos = signal<Producto[]>([]);
  readonly categorias = signal<Categoria[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);

  readonly estados = [
    { etiqueta: 'Solo activos', valor: true },
    { etiqueta: 'Solo dados de baja', valor: false },
  ];

  filtro: FiltroProductos = {};
  private temporizador?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    forkJoin({ categorias: this.servicio.categorias(true) })
      .subscribe(({ categorias }) => this.categorias.set(categorias.data));

    this.cargar(0);
  }

  cargar(desde = 0): void {
    this.cargando.set(true);

    this.servicio.productos(this.filtro, Math.floor(desde / 20) + 1).subscribe({
      next: res => {
        this.productos.set(res.data);
        this.total.set(res.meta.total);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  buscar(texto: string): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => {
      this.filtro.buscar = texto;
      this.cargar(0);
    }, 300);
  }

  cambiarEstado(producto: Producto): void {
    const reactivar = !producto.activo;

    this.confirmar.confirm({
      header: reactivar ? 'Reactivar producto' : 'Dar de baja el producto',
      message: reactivar
        ? `${producto.nombre} volverá a aparecer al registrar movimientos.`
        : `${producto.nombre} dejará de aparecer al registrar movimientos. `
          + 'Sus existencias y su kardex se conservan, y puede reactivarlo cuando quiera.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: reactivar ? 'Reactivar' : 'Dar de baja',
      rejectLabel: 'Cancelar',
      accept: () => this.servicio.cambiarEstadoProducto(producto.id, reactivar).subscribe(() => {
        this.mensajes.add({
          severity: 'success',
          summary: reactivar ? 'Producto reactivado' : 'Producto dado de baja',
          detail: producto.nombre,
        });
        this.cargar(0);
      }),
    });
  }
}
