import { DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { TooltipModule } from 'primeng/tooltip';
import { FiltroIngresos, Ingreso, MARCA_INGRESO } from '../../core/models/ingreso.models';
import { IngresoService } from '../../core/services/ingreso.service';
import { PermisosService } from '../../core/services/permisos.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-ingreso-lista',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, TitleCasePipe, TableModule, ButtonModule,
    InputTextModule, DropdownModule, ToggleButtonModule, TooltipModule,
    TienePermisoDirective,
  ],
  template: `
    <header class="pagina">
      <div>
        <h1>Ingresos de almacén</h1>
        <p>Cada ingreso responde a una solicitud de compra aprobada. Al
           confirmarlo entra el material y se registra su costo.</p>
      </div>
      <div class="acciones">
        <button pButton routerLink="/ingresos/nuevo" icon="pi pi-plus"
                label="Registrar ingreso" *appTienePermiso="'ingresos.registrar'"></button>
      </div>
    </header>

    <div class="filtros">
      <span class="p-input-icon-left crece">
        <i class="pi pi-search"></i>
        <input pInputText type="search" class="crece"
               placeholder="Número, proveedor o documento"
               (input)="buscar($any($event.target).value)" />
      </span>

      <p-dropdown [options]="estados" [(ngModel)]="filtro.estado" optionLabel="etiqueta"
                  optionValue="valor" placeholder="Todos los estados"
                  [showClear]="true" (onChange)="cargar(0)" />

      <p-toggleButton [(ngModel)]="soloSinRespaldo"
                      onLabel="Sin factura" offLabel="Sin factura"
                      onIcon="pi pi-filter-fill" offIcon="pi pi-filter"
                      pTooltip="Confirmados a los que falta adjuntar el documento del proveedor"
                      (onChange)="alternarRespaldo()" />
    </div>

    <p-table [value]="ingresos()" [loading]="cargando()" [paginator]="true" [rows]="20"
             [totalRecords]="total()" [lazy]="true" (onLazyLoad)="cargar($event.first ?? 0)"
             dataKey="id" styleClass="p-datatable-sm">

      <ng-template pTemplate="header">
        <tr>
          <th style="width:13rem">Número</th>
          <th style="width:6.5rem">Fecha</th>
          <th>Proveedor</th>
          <th style="width:12rem">Solicitud</th>
          <th style="width:10rem">Estado</th>
          <th style="width:5rem" class="cifra">Ítems</th>
          <th style="width:4rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-i>
        <tr class="marca" [class]="marca(i)" [class.atenuada]="i.estado === 'anulada'">
          <td><span class="codigo">{{ i.numero }}</span></td>
          <td>{{ i.fecha | date:'dd/MM/yy' }}</td>
          <td>
            <div class="proveedor">{{ i.proveedor }}</div>
            @if (i.numero_documento) {
              <div class="documento">
                {{ i.tipo_documento === 'nota-entrega' ? 'Nota de entrega' : (i.tipo_documento | titlecase) }}
                {{ i.numero_documento }}
              </div>
            }
          </td>
          <td><span class="codigo tenue">{{ i.solicitud_numero }}</span></td>
          <td>
            <span class="estado" [class]="'estado-' + i.estado">{{ i.estado_etiqueta }}</span>
            @if (i.estado === 'confirmada') {
              @if (i.tiene_respaldo) {
                <i class="pi pi-paperclip adjunto" pTooltip="Documento del proveedor adjunto"></i>
              } @else {
                <i class="pi pi-exclamation-circle falta"
                   pTooltip="Falta adjuntar el documento del proveedor"></i>
              }
            }
          </td>
          <td class="cifra">{{ i.lineas ?? 0 }}</td>
          <td class="fila-acciones">
            <button pButton icon="pi pi-arrow-right" text rounded
                    [routerLink]="['/ingresos', i.id]" pTooltip="Abrir"></button>
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="7">
          <div class="vacio">
            <i class="pi pi-arrow-down-left"></i>
            <p>{{ soloSinRespaldo
                ? 'Todos los ingresos confirmados tienen su documento adjunto.'
                : 'No hay ingresos que coincidan con la búsqueda.' }}</p>
          </div>
        </td></tr>
      </ng-template>
    </p-table>
  `,
  styles: [`
    .proveedor { font-weight:500; }
    .documento { font-size:var(--t-xs); color:var(--tinta-suave); }
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
export class IngresoListaComponent implements OnInit {
  private readonly servicio = inject(IngresoService);
  readonly permisos = inject(PermisosService);

  readonly ingresos = signal<Ingreso[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);

  readonly estados = [
    { etiqueta: 'Borrador', valor: 'borrador' },
    { etiqueta: 'Confirmado', valor: 'confirmada' },
    { etiqueta: 'Anulado', valor: 'anulada' },
  ];

  filtro: FiltroIngresos = {};
  soloSinRespaldo = false;

  private temporizador?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.cargar(0);
  }

  marca(ingreso: Ingreso): string {
    return MARCA_INGRESO[ingreso.estado] ?? '';
  }

  alternarRespaldo(): void {
    this.filtro.sin_respaldo = this.soloSinRespaldo || undefined;
    this.cargar(0);
  }

  cargar(desde = 0): void {
    this.cargando.set(true);

    this.servicio.listar(this.filtro, Math.floor(desde / 20) + 1).subscribe({
      next: res => {
        this.ingresos.set(res.data);
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
