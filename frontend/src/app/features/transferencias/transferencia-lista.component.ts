import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { TooltipModule } from 'primeng/tooltip';
import {
  FiltroTransferencias, MARCA_TRANSFERENCIA, Transferencia,
} from '../../core/models/transferencia.models';
import { TransferenciaService } from '../../core/services/transferencia.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-transferencia-lista',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, TableModule, ButtonModule, InputTextModule,
    DropdownModule, ToggleButtonModule, TooltipModule, TienePermisoDirective,
  ],
  template: `
    <header class="pagina">
      <div>
        <h1>Transferencias</h1>
        <p>Traslados entre almacenes. El material sale del origen y llega al
           destino en dos momentos: entre medio está en tránsito.</p>
      </div>
      <div class="acciones">
        <button pButton routerLink="/transferencias/nueva" icon="pi pi-plus"
                label="Nueva transferencia"
                *appTienePermiso="'transferencias.registrar'"></button>
      </div>
    </header>

    <div class="filtros">
      <span class="p-input-icon-left crece">
        <i class="pi pi-search"></i>
        <input pInputText type="search" class="crece"
               placeholder="Número o transportista"
               (input)="buscar($any($event.target).value)" />
      </span>

      <p-dropdown [options]="estados" [(ngModel)]="filtro.estado" optionLabel="etiqueta"
                  optionValue="valor" placeholder="Todos los estados"
                  [showClear]="true" (onChange)="cargar(0)" />

      <p-toggleButton [(ngModel)]="soloPorRecibir"
                      onLabel="Por recibir" offLabel="Por recibir"
                      onIcon="pi pi-inbox" offIcon="pi pi-inbox"
                      pTooltip="Lo que otro almacén me despachó y espera que reciba"
                      (onChange)="alternarPorRecibir()" />
    </div>

    <p-table [value]="transferencias()" [loading]="cargando()" [paginator]="true" [rows]="20"
             [totalRecords]="total()" [lazy]="true" (onLazyLoad)="cargar($event.first ?? 0)"
             dataKey="id" styleClass="p-datatable-sm">

      <ng-template pTemplate="header">
        <tr>
          <th style="width:13rem">Número</th>
          <th style="width:6.5rem">Fecha</th>
          <th>Recorrido</th>
          <th style="width:11rem">Estado</th>
          <th style="width:5rem" class="cifra">Ítems</th>
          <th style="width:4rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-t>
        <tr class="marca" [class]="marca(t)" [class.atenuada]="t.estado === 'anulada'">
          <td><span class="codigo">{{ t.numero }}</span></td>
          <td>{{ t.fecha | date:'dd/MM/yy' }}</td>
          <td>
            <div class="recorrido">
              <span>{{ t.origen }}</span>
              <i class="pi pi-arrow-right"></i>
              <span>{{ t.destino }}</span>
            </div>
            @if (t.transportista) {
              <div class="transportista">Lleva {{ t.transportista }}</div>
            }
          </td>
          <td>
            <span class="estado" [class]="'estado-' + t.estado">{{ t.estado_etiqueta }}</span>
            @if (t.estado === 'despachada' && t.puede_recibir) {
              <i class="pi pi-inbox esperando" pTooltip="Esperando que usted la reciba"></i>
            }
          </td>
          <td class="cifra">{{ t.lineas ?? 0 }}</td>
          <td class="fila-acciones">
            <button pButton icon="pi pi-arrow-right" text rounded
                    [routerLink]="['/transferencias', t.id]" pTooltip="Abrir"></button>
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="6">
          <div class="vacio">
            <i class="pi pi-arrows-h"></i>
            <p>{{ soloPorRecibir
                ? 'No hay material en camino hacia sus almacenes.'
                : 'No hay transferencias que coincidan con la búsqueda.' }}</p>
          </div>
        </td></tr>
      </ng-template>
    </p-table>
  `,
  styles: [`
    .recorrido { display:flex; align-items:center; gap:.5rem; font-weight:500; }
    .recorrido i { font-size:.6875rem; color:var(--tinta-tenue); }
    .transportista { font-size:var(--t-xs); color:var(--tinta-suave); }
    .fila-acciones { text-align:right; }

    .estado { display:inline-block; padding:.0625rem .4375rem; border-radius:2px;
              font-size:var(--t-xs); border:1px solid var(--linea);
              color:var(--tinta-suave); }
    .estado-despachada { border-color:var(--aviso); color:var(--aviso);
                         background:var(--aviso-lavado); }
    .estado-recibida { border-color:var(--bien); color:var(--bien); }
    .estado-anulada { border-color:var(--alerta); color:var(--alerta); }

    .esperando { margin-left:.375rem; color:var(--acento); font-size:.8125rem; }
  `],
})
export class TransferenciaListaComponent implements OnInit {
  private readonly servicio = inject(TransferenciaService);

  readonly transferencias = signal<Transferencia[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);

  readonly estados = [
    { etiqueta: 'Borrador', valor: 'borrador' },
    { etiqueta: 'En tránsito', valor: 'despachada' },
    { etiqueta: 'Recibida', valor: 'recibida' },
    { etiqueta: 'Anulada', valor: 'anulada' },
  ];

  filtro: FiltroTransferencias = {};
  soloPorRecibir = false;

  private temporizador?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.cargar(0);
  }

  marca(t: Transferencia): string {
    return MARCA_TRANSFERENCIA[t.estado] ?? '';
  }

  /** La bandeja de entrada del almacenero: lo que le está llegando. */
  alternarPorRecibir(): void {
    this.filtro.por_recibir = this.soloPorRecibir || undefined;
    this.cargar(0);
  }

  cargar(desde = 0): void {
    this.cargando.set(true);

    this.servicio.listar(this.filtro, Math.floor(desde / 20) + 1).subscribe({
      next: res => {
        this.transferencias.set(res.data);
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
}
