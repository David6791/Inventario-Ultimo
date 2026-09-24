import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import {
  Devolucion, FiltroDevoluciones, MARCA_DEVOLUCION, MOTIVOS_DEVOLUCION,
} from '../../core/models/devolucion.models';
import { DevolucionService } from '../../core/services/devolucion.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-devolucion-lista',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, DecimalPipe, TableModule, ButtonModule,
    InputTextModule, DropdownModule, CalendarModule, TooltipModule, TienePermisoDirective,
  ],
  template: `
    <header class="pagina">
      <div>
        <h1>Devoluciones</h1>
        <p>El material vuelve al almacén al costo con que salió, no al precio de hoy.
           Se descuenta del consumo del área en el mes en que se registra.</p>
      </div>
      <div class="acciones">
        <button pButton routerLink="/devoluciones/nueva" icon="pi pi-plus"
                label="Registrar devolución" *appTienePermiso="'devoluciones.registrar'"></button>
      </div>
    </header>

    <div class="filtros">
      <span class="p-input-icon-left crece">
        <i class="pi pi-search"></i>
        <input pInputText type="search" class="crece"
               placeholder="Número, salida o unidad"
               (input)="buscar($any($event.target).value)" />
      </span>

      <p-calendar [(ngModel)]="desde" dateFormat="dd/mm/yy" placeholder="Desde"
                  [showIcon]="true" (onSelect)="aplicarFechas()" />

      <p-calendar [(ngModel)]="hasta" dateFormat="dd/mm/yy" placeholder="Hasta"
                  [showIcon]="true" (onSelect)="aplicarFechas()" />

      <p-dropdown [options]="estados" [(ngModel)]="filtro.estado" optionLabel="etiqueta"
                  optionValue="valor" placeholder="Todos los estados"
                  [showClear]="true" (onChange)="cargar(0)" />
    </div>

    <p-table [value]="devoluciones()" [loading]="cargando()" [paginator]="true" [rows]="25"
             [totalRecords]="total()" [lazy]="true" (onLazyLoad)="cargar($event.first ?? 0)"
             dataKey="id" styleClass="p-datatable-sm">

      <ng-template pTemplate="header">
        <tr>
          <th style="width:13rem">Número</th>
          <th style="width:6.5rem">Fecha</th>
          <th style="width:12rem">Salida origen</th>
          <th>Unidad solicitante</th>
          <th style="width:14rem">Motivo</th>
          <th style="width:5rem" class="cifra">Ítems</th>
          <th style="width:9rem" class="cifra">Costo Bs</th>
          <th style="width:4rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-d>
        <tr class="marca" [class]="marca(d)" [class.atenuada]="d.estado === 'anulada'">
          <td><span class="codigo">{{ d.numero }}</span></td>
          <td>{{ d.fecha | date:'dd/MM/yy' }}</td>
          <td>
            <a class="codigo enlace" [routerLink]="['/salidas', d.salida_id]"
               pTooltip="Ver la salida de origen">{{ d.salida_numero }}</a>
          </td>
          <td>
            <div class="unidad">{{ d.unidad_nombre ?? '—' }}</div>
            <div class="persona">{{ d.solicitante_nombre }}</div>
          </td>
          <td class="tenue">{{ etiquetaMotivo(d.motivo) }}</td>
          <td class="cifra">{{ d.cantidad_lineas }}</td>
          <td class="cifra importe">{{ d.costo_total | number:'1.2-2' }}</td>
          <td class="fila-acciones">
            <button pButton icon="pi pi-arrow-right" text rounded
                    [routerLink]="['/devoluciones', d.id]" pTooltip="Abrir"></button>
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="8">
          <div class="vacio">
            <i class="pi pi-reply"></i>
            <p>No hay devoluciones en el periodo seleccionado.</p>
          </div>
        </td></tr>
      </ng-template>
    </p-table>
  `,
  styles: [`
    .unidad { font-weight:500; }
    .persona { font-size:var(--t-xs); color:var(--tinta-suave); }
    .tenue { color:var(--tinta-suave); }
    .importe { font-variant-numeric:tabular-nums; }
    .enlace { color:inherit; text-decoration:none; border-bottom:1px dotted var(--linea); }
    .enlace:hover { border-bottom-color:var(--tinta-suave); }
    .fila-acciones { text-align:right; }
  `],
})
export class DevolucionListaComponent implements OnInit {
  private readonly servicio = inject(DevolucionService);

  readonly devoluciones = signal<Devolucion[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);

  readonly estados = [
    { etiqueta: 'Registrada', valor: 'registrada' },
    { etiqueta: 'Anulada', valor: 'anulada' },
  ];

  filtro: FiltroDevoluciones = {};
  desde?: Date;
  hasta?: Date;

  private temporizador?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.cargar(0);
  }

  marca(devolucion: Devolucion): string {
    return MARCA_DEVOLUCION[devolucion.estado] ?? '';
  }

  etiquetaMotivo(valor: string): string {
    return MOTIVOS_DEVOLUCION.find(m => m.valor === valor)?.etiqueta ?? valor;
  }

  aplicarFechas(): void {
    this.filtro.desde = this.desde ? this.iso(this.desde) : undefined;
    this.filtro.hasta = this.hasta ? this.iso(this.hasta) : undefined;
    this.cargar(0);
  }

  cargar(desde = 0): void {
    this.cargando.set(true);

    this.servicio.listar(this.filtro, Math.floor(desde / 25) + 1).subscribe({
      next: res => {
        this.devoluciones.set(res.data);
        this.total.set(res.total);
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

  private iso(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
  }
}
