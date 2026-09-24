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
import { FiltroSalidas, MARCA_SALIDA, Salida } from '../../core/models/salida.models';
import { SalidaService } from '../../core/services/salida.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-salida-lista',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, TableModule, ButtonModule, InputTextModule,
    DropdownModule, ToggleButtonModule, TooltipModule, TienePermisoDirective,
  ],
  template: `
    <header class="pagina">
      <div>
        <h1>Salidas de almacén</h1>
        <p>Se registra la entrega, se imprime la nota, quien retira la firma y
           se confirma. Recién al confirmar se descuentan las existencias.</p>
      </div>
      <div class="acciones">
        <button pButton routerLink="/salidas/nueva" icon="pi pi-plus"
                label="Registrar salida" *appTienePermiso="'salidas.registrar'"></button>
      </div>
    </header>

    <div class="filtros">
      <span class="p-input-icon-left crece">
        <i class="pi pi-search"></i>
        <input pInputText type="search" class="crece"
               placeholder="Número, unidad o quien recibió"
               (input)="buscar($any($event.target).value)" />
      </span>

      <p-dropdown [options]="estados" [(ngModel)]="filtro.estado" optionLabel="etiqueta"
                  optionValue="valor" placeholder="Todos los estados"
                  [showClear]="true" (onChange)="cargar(0)" />

      <p-toggleButton [(ngModel)]="soloSinRespaldo"
                      onLabel="Sin respaldo" offLabel="Sin respaldo"
                      onIcon="pi pi-filter-fill" offIcon="pi pi-filter"
                      pTooltip="Confirmadas a las que todavía les falta el escaneo firmado"
                      (onChange)="alternarRespaldo()" />
    </div>

    <p-table [value]="salidas()" [loading]="cargando()" [paginator]="true" [rows]="20"
             [totalRecords]="total()" [lazy]="true" (onLazyLoad)="cargar($event.first ?? 0)"
             dataKey="id" styleClass="p-datatable-sm">

      <ng-template pTemplate="header">
        <tr>
          <th style="width:13rem">Número</th>
          <th style="width:6.5rem">Fecha</th>
          <th>Unidad solicitante</th>
          <th style="width:12rem">Recibió</th>
          <th style="width:10rem">Estado</th>
          <th style="width:5rem" class="cifra">Ítems</th>
          <th style="width:4rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-s>
        <tr class="marca" [class]="marca(s)" [class.atenuada]="s.estado === 'anulada'">
          <td><span class="codigo">{{ s.numero }}</span></td>
          <td>{{ s.fecha | date:'dd/MM/yy' }}</td>
          <td>
            <div class="unidad">{{ s.unidad_solicitante }}</div>
            <div class="persona">{{ s.solicitante }}</div>
          </td>
          <td class="tenue">{{ s.recibido_por }}</td>
          <td>
            <span class="estado" [class]="'estado-' + s.estado">{{ s.estado_etiqueta }}</span>
            @if (s.estado === 'confirmada') {
              @if (s.tiene_respaldo) {
                <i class="pi pi-paperclip adjunto" pTooltip="Nota firmada adjunta"></i>
              } @else {
                <i class="pi pi-exclamation-circle falta"
                   pTooltip="Falta subir la nota firmada"></i>
              }
            }
          </td>
          <td class="cifra">{{ s.lineas ?? 0 }}</td>
          <td class="fila-acciones">
            <button pButton icon="pi pi-arrow-right" text rounded
                    [routerLink]="['/salidas', s.id]" pTooltip="Abrir"></button>
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="7">
          <div class="vacio">
            <i class="pi pi-arrow-up-right"></i>
            <p>{{ soloSinRespaldo
                ? 'Todas las salidas confirmadas tienen su nota firmada adjunta.'
                : 'No hay salidas que coincidan con la búsqueda.' }}</p>
          </div>
        </td></tr>
      </ng-template>
    </p-table>
  `,
  styles: [`
    .unidad { font-weight:500; }
    .persona { font-size:var(--t-xs); color:var(--tinta-suave); }
    .tenue { color:var(--tinta-suave); }
    .fila-acciones { text-align:right; }

    .estado { display:inline-block; padding:.0625rem .4375rem; border-radius:2px;
              font-size:var(--t-xs); border:1px solid var(--linea);
              color:var(--tinta-suave); }
    .estado-confirmada { border-color:var(--bien); color:var(--bien); }
    .estado-anulada { border-color:var(--alerta); color:var(--alerta); }

    .adjunto { margin-left:.375rem; color:var(--tinta-tenue); font-size:.75rem; }
    .falta { margin-left:.375rem; color:var(--aviso); font-size:.8125rem; }
  `],
})
export class SalidaListaComponent implements OnInit {
  private readonly servicio = inject(SalidaService);

  readonly salidas = signal<Salida[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);

  readonly estados = [
    { etiqueta: 'Borrador', valor: 'borrador' },
    { etiqueta: 'Confirmada', valor: 'confirmada' },
    { etiqueta: 'Anulada', valor: 'anulada' },
  ];

  filtro: FiltroSalidas = {};
  soloSinRespaldo = false;

  private temporizador?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.cargar(0);
  }

  marca(salida: Salida): string {
    return MARCA_SALIDA[salida.estado] ?? '';
  }

  /** El filtro de respaldo pendiente es el que se revisa al cierre del día. */
  alternarRespaldo(): void {
    this.filtro.sin_respaldo = this.soloSinRespaldo || undefined;
    this.cargar(0);
  }

  cargar(desde = 0): void {
    this.cargando.set(true);

    this.servicio.listar(this.filtro, Math.floor(desde / 20) + 1).subscribe({
      next: res => {
        this.salidas.set(res.data);
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
