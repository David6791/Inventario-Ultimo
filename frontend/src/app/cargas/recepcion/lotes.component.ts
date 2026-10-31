import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { Subject, debounceTime } from 'rxjs';
import { formatoDinero } from '../../caja/core/dinero';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { Lote, Opciones, SerieLote } from '../core/models/cargas.model';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';
import { RecepcionService } from '../core/services/recepcion.service';
import { SeriesService } from '../core/services/series.service';

/** Lotes recibidos, con filtros por estado, serie, productor o código, y fechas. */
@Component({
  selector: 'app-lotes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonModule, DropdownModule, InputTextModule, TableModule, ToastModule,
            TienePermisoDirective],
  providers: [MessageService],
  template: `
    <p-toast />
    <header class="encabezado">
      <div>
        <h2>Lotes</h2>
        <p class="subtitulo">El mineral recibido, de compra y de producción propia. Toque un lote para ver sus pesajes y su bono.
          <a routerLink="/cargas/resumen">Ver el resumen y el tablero</a>.</p>
      </div>
      <div class="acciones" *appTienePermiso="'cargas.recibir'">
        <p-button label="Recibir lote" icon="pi pi-plus" routerLink="/cargas/lotes/recibir" />
      </div>
    </header>

    <div class="barra">
      <span class="campo-busqueda">
        <i class="pi pi-search"></i>
        <input pInputText type="search" placeholder="Código, productor, CI o NIT" [(ngModel)]="f.buscar" (ngModelChange)="buscar$.next()" />
      </span>
      <p-dropdown class="filtro" [options]="opciones()?.estados_lote ?? []" [(ngModel)]="f.estado" optionLabel="etiqueta" optionValue="valor"
                  placeholder="Todos los estados" [showClear]="true" (onChange)="recargar()" />
      <p-dropdown class="filtro" *ngIf="(opciones()?.acopios?.length ?? 0) > 1" [options]="opciones()?.acopios ?? []" [(ngModel)]="f.almacen_id"
                  optionLabel="nombre" optionValue="id" placeholder="Todos los acopios" [showClear]="true" (onChange)="recargar()" />
      <p-dropdown class="filtro" [options]="series()" [(ngModel)]="f.serie_id" optionLabel="nombre" optionValue="id"
                  placeholder="Todos los tipos" [showClear]="true" (onChange)="recargar()" />
      <p-dropdown class="filtro" [options]="materiales()" [(ngModel)]="f.material" optionLabel="etiqueta" optionValue="valor"
                  placeholder="Todo material" [showClear]="true" (onChange)="recargar()" />
      <p-dropdown class="filtro" [options]="origenes" [(ngModel)]="f.origen" optionLabel="etiqueta" optionValue="valor"
                  placeholder="Compra y propia" [showClear]="true" (onChange)="recargar()" />
      <input pInputText type="date" [(ngModel)]="f.desde" (change)="recargar()" title="Desde" />
      <input pInputText type="date" [(ngModel)]="f.hasta" (change)="recargar()" title="Hasta" />
    </div>

    <p-table [value]="lotes()" [lazy]="true" (onLazyLoad)="cargar($event)" [paginator]="true" [rows]="25" [totalRecords]="total()"
             [loading]="cargando()" dataKey="id" styleClass="p-datatable-sm tabla" selectionMode="single" (onRowSelect)="abrir($event.data)">
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 11rem">Lote</th>
          <th style="width: 8rem">Recibido</th>
          <th style="width: 10rem">Acopio</th>
          <th>Productor u origen</th>
          <th style="width: 12rem">Mina</th>
          <th style="width: 9rem" class="derecha">Neto húmedo kg</th>
          <th style="width: 14rem">Ley final</th>
          <th style="width: 8rem" class="derecha">Bono por pagar</th>
          <th style="width: 8rem">Estado</th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-l>
        <tr [pSelectableRow]="l" class="fila" [class.inactiva]="l.estado === 'ANULADO'">
          <td><span class="codigo">{{ l.codigo }}</span><div class="secundario">{{ l.linea?.codigo }}</div></td>
          <td>{{ l.fecha_recepcion | date: 'dd/MM/yy HH:mm' }}</td>
          <td>{{ l.almacen?.centro_costo?.nombre ?? l.almacen?.nombre }}<div class="secundario codigo" *ngIf="l.material">{{ l.material }}</div></td>
          <td>{{ l.productor?.nombre ?? 'Producción propia' }}<div class="secundario">{{ l.cooperativa?.nombre }}</div></td>
          <td>{{ l.mina?.nombre ?? '—' }}<div class="secundario" *ngIf="l.bocamina">Bocamina {{ l.bocamina.codigo }}</div></td>
          <td class="derecha monto">{{ kg(l.peso_neto_humedo_kg) }}<div class="secundario">{{ l.num_pesajes }} pesaje(s)</div></td>
          <td class="leyes"><ng-container *ngIf="l.humedad_pct !== null && l.humedad_pct !== undefined; else sinLey">
            <span *ngIf="l.ley_zn">Zn {{ ley(l.ley_zn) }}</span> <span *ngIf="l.ley_pb">Pb {{ ley(l.ley_pb) }}</span>
            <span *ngIf="l.ley_ag">Ag {{ ley(l.ley_ag) }}</span>
            <div class="secundario">H₂O {{ ley(l.humedad_pct) }} % · seco {{ kg(l.peso_neto_seco_kg!) }}</div></ng-container>
            <ng-template #sinLey><span class="secundario">—</span></ng-template></td>
          <td class="derecha monto">{{ +l.bonos_por_pagar ? 'Bs ' + kg(l.bonos_por_pagar) : '—' }}</td>
          <td><span class="pastilla" [class.pastilla-acento]="l.estado === 'RECIBIDO'" [class.pastilla-aviso]="l.estado === 'ANULADO'">{{ etiqueta(l.estado) }}</span></td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="9"><div class="vacio"><i class="pi pi-truck"></i><div class="titulo-vacio">No hay lotes con esos filtros</div></div></td></tr>
      </ng-template>
    </p-table>
  `,
  styles: [ESTILOS_CARGAS, `
    .fila { cursor: pointer; }
    .leyes { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 0.82rem; }
    .leyes span { margin-right: 0.4rem; }
    .monto { font-family: ui-monospace, 'SF Mono', Menlo, monospace; white-space: nowrap; }
  `],
})
export class LotesComponent implements OnInit {
  private readonly servicio = inject(RecepcionService);
  private readonly catalogos = inject(CatalogosCargasService);
  private readonly seriesSrv = inject(SeriesService);
  private readonly toast = inject(MessageService);
  private readonly router = inject(Router);
  private readonly destruir = inject(DestroyRef);

  readonly lotes = signal<Lote[]>([]);
  readonly series = signal<SerieLote[]>([]);
  readonly opciones = signal<Opciones | null>(null);
  readonly total = signal(0);
  readonly cargando = signal(false);
  readonly buscar$ = new Subject<void>();

  f: { buscar: string; estado: string | null; serie_id: number | null; desde: string; hasta: string;
       almacen_id: number | null; material: string | null; origen: string | null } =
    { buscar: '', estado: null, serie_id: null, desde: '', hasta: '', almacen_id: null, material: null, origen: null };
  readonly origenes = [{ valor: 'COMPRA', etiqueta: 'Compra' }, { valor: 'PROPIA', etiqueta: 'Producción propia' }];
  materiales() { return [...(this.opciones()?.materiales ?? []), { valor: 'SIN', etiqueta: 'Sin material' }]; }
  private pagina = 1;

  ngOnInit(): void {
    this.catalogos.opciones$.subscribe((o) => this.opciones.set(o));
    this.seriesSrv.listar().subscribe((r) => this.series.set(r.data));
    this.buscar$.pipe(debounceTime(300), takeUntilDestroyed(this.destruir)).subscribe(() => this.recargar());
  }

  cargar(e: TableLazyLoadEvent): void {
    this.pagina = Math.floor((e.first ?? 0) / (e.rows ?? 25)) + 1;
    this.pedir();
  }

  recargar(): void { this.pagina = 1; this.pedir(); }

  private pedir(): void {
    this.cargando.set(true);
    this.servicio.listar({ ...this.f, page: this.pagina }).subscribe({
      next: (r) => { this.lotes.set(r.data); this.total.set(r.total); this.cargando.set(false); },
      error: (e) => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo cargar la lista', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }

  abrir(l: Lote): void { this.router.navigate(['/cargas/lotes', l.id]); }
  kg(v: string | number): string { return formatoDinero(v); }
  ley(v: string | number): string { return Number(v).toLocaleString('es-BO', { maximumFractionDigits: 3 }); }
  etiqueta(e: string): string { return this.opciones()?.estados_lote?.find((x) => x.valor === e)?.etiqueta ?? e; }
}
