import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import {
  FiltroSolicitudes, MARCA_ESTADO, Solicitud,
} from '../../core/models/solicitud.models';
import { SolicitudService } from '../../core/services/solicitud.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-solicitud-lista',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, TableModule, ButtonModule,
    InputTextModule, DropdownModule, TooltipModule, TienePermisoDirective,
  ],
  template: `
    <header class="pagina">
      <div>
        <h1>Solicitudes de compra</h1>
        <p>Piden material que entrará al almacén. Una vez aprobadas, el ingreso
           se registra contra ellas y descuenta sus saldos.</p>
      </div>
      <div class="acciones">
        <button pButton routerLink="/solicitudes/nueva" icon="pi pi-plus"
                label="Nueva solicitud"
                *appTienePermiso="'solicitudes.registrar'"></button>
      </div>
    </header>

    <div class="filtros">
      <span class="p-input-icon-left crece">
        <i class="pi pi-search"></i>
        <input pInputText type="search" class="crece"
               placeholder="Número, unidad o solicitante"
               (input)="buscar($any($event.target).value)" />
      </span>

      <p-dropdown [options]="estados" [(ngModel)]="filtro.estado" optionLabel="etiqueta"
                  optionValue="valor" placeholder="Todos los estados"
                  [showClear]="true" (onChange)="cargar(0)" />
    </div>

    <p-table [value]="solicitudes()" [loading]="cargando()" [paginator]="true" [rows]="20"
             [totalRecords]="total()" [lazy]="true" (onLazyLoad)="cargar($event.first ?? 0)"
             dataKey="id" styleClass="p-datatable-sm">

      <ng-template pTemplate="header">
        <tr>
          <th style="width:13rem">Número</th>
          <th style="width:6.5rem">Fecha</th>
          <th>Unidad solicitante</th>
          <th style="width:11rem">Estado</th>
          <th style="width:5.5rem" class="cifra">Ítems</th>
          <th style="width:4rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-s>
        <tr class="marca" [class]="marca(s)"
            [class.atenuada]="s.estado === 'anulada' || s.estado === 'rechazada'">
          <td><span class="codigo">{{ s.numero }}</span></td>
          <td>{{ s.fecha | date:'dd/MM/yy' }}</td>
          <td>
            <div class="unidad">{{ s.unidad_solicitante }}</div>
            <div class="persona">{{ s.solicitante }}</div>
          </td>
          <td>
            <span class="estado" [class]="'estado-' + s.estado">{{ s.estado_etiqueta }}</span>
            @if (s.documento_nombre) {
              <i class="pi pi-paperclip adjunto"
                 pTooltip="Tiene el documento firmado adjunto"></i>
            }
          </td>
          <td class="cifra">{{ s.lineas ?? 0 }}</td>
          <td class="fila-acciones">
            <button pButton icon="pi pi-arrow-right" text rounded
                    [routerLink]="['/solicitudes', s.id]" pTooltip="Abrir"></button>
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="6">
          <div class="vacio">
            <i class="pi pi-file-edit"></i>
            <p>No hay solicitudes que coincidan. Registre una para iniciar una
               compra.</p>
          </div>
        </td></tr>
      </ng-template>
    </p-table>
  `,
  styles: [`
    .unidad { font-weight:500; }
    .persona { font-size:var(--t-xs); color:var(--tinta-suave); }
    .fila-acciones { text-align:right; }

    /* El estado se lee como etiqueta de archivo, no como botón. */
    .estado { display:inline-block; padding:.0625rem .4375rem; border-radius:2px;
              font-size:var(--t-xs); border:1px solid var(--linea);
              color:var(--tinta-suave); }
    .estado-aprobada { border-color:var(--acento); color:var(--acento);
                       background:var(--acento-lavado); }
    .estado-atendida_parcial { border-color:var(--aviso); color:var(--aviso);
                               background:var(--aviso-lavado); }
    .estado-atendida { border-color:var(--bien); color:var(--bien); }
    .estado-rechazada, .estado-anulada { border-color:var(--alerta);
                                         color:var(--alerta); }
    .adjunto { margin-left:.375rem; color:var(--tinta-tenue); font-size:.75rem; }
  `],
})
export class SolicitudListaComponent implements OnInit {
  private readonly servicio = inject(SolicitudService);

  readonly solicitudes = signal<Solicitud[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);

  readonly estados = [
    { etiqueta: 'Borrador', valor: 'borrador' },
    { etiqueta: 'Aprobada', valor: 'aprobada' },
    { etiqueta: 'Atendida en parte', valor: 'atendida_parcial' },
    { etiqueta: 'Atendida', valor: 'atendida' },
    { etiqueta: 'Rechazada', valor: 'rechazada' },
    { etiqueta: 'Anulada', valor: 'anulada' },
  ];

  filtro: FiltroSolicitudes = {};
  private temporizador?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.cargar(0);
  }

  marca(solicitud: Solicitud): string {
    return MARCA_ESTADO[solicitud.estado] ?? '';
  }

  cargar(desde = 0): void {
    this.cargando.set(true);

    this.servicio.listar('compra', this.filtro, Math.floor(desde / 20) + 1).subscribe({
      next: res => {
        this.solicitudes.set(res.data);
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
