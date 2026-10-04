import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ActivoService } from '../core/services/activo.service';
import { CatalogoService } from '../core/services/catalogo.service';
import { Clase, Ubicacion } from '../core/models/catalogo.model';
import { ActivoLista, ESTADOS_ACTIVO, FiltrosActivo, SeveridadTag } from '../core/models/activo.model';

@Component({
  selector: 'app-activo-lista',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, TableModule, ButtonModule,
    DropdownModule, InputTextModule, TagModule, ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Activos fijos</h2>
        <p class="subtitulo">
          <strong>{{ total() }}</strong> bien(es) registrado(s)
          <span class="separador">·</span>
          El código no se reutiliza, ni siquiera tras una baja
        </p>
      </div>

      <div class="acciones">
        <p-button
          [label]="seleccionados().length ? 'Etiquetas (' + seleccionados().length + ')' : 'Etiquetas'"
          icon="pi pi-qrcode"
          severity="secondary"
          [outlined]="true"
          [disabled]="!seleccionados().length"
          (onClick)="imprimirEtiquetas()"
        />
        <p-button label="Importar" icon="pi pi-file-excel" severity="secondary"
          [outlined]="true" routerLink="/activos/registro/importar" />
        <p-button label="Nuevo activo" icon="pi pi-plus" routerLink="/activos/registro/nuevo" />
      </div>
    </header>

    <section class="filtros">
      <span class="campo-busqueda">
        <i class="pi pi-search"></i>
        <input
          pInputText
          placeholder="Código, denominación, serie o marca…"
          [(ngModel)]="filtros.buscar"
          (keyup.enter)="buscar()"
        />
      </span>

      <p-dropdown
        [options]="clases()" optionLabel="nombre" optionValue="id"
        placeholder="Clase" [showClear]="true" appendTo="body"
        [(ngModel)]="filtros.clase_id" (onChange)="buscar()"
      />

      <p-dropdown
        [options]="ubicaciones()" optionLabel="nombre" optionValue="id"
        placeholder="Ubicación" [showClear]="true" appendTo="body"
        [(ngModel)]="filtros.ubicacion_id" (onChange)="buscar()"
      />

      <p-dropdown
        [options]="estados" optionLabel="etiqueta" optionValue="valor"
        placeholder="Estado" [showClear]="true" appendTo="body"
        [(ngModel)]="filtros.estado" (onChange)="buscar()"
      />

      <p-button
        label="Limpiar" icon="pi pi-filter-slash" [text]="true"
        [disabled]="!hayFiltros()" (onClick)="limpiar()"
      />
    </section>

    <p-table
      [value]="activos()"
      [lazy]="true"
      (onLazyLoad)="cargar($event)"
      [loading]="cargando()"
      [paginator]="true"
      [rows]="20"
      [totalRecords]="total()"
      [(selection)]="seleccionadosModel"
      (selectionChange)="seleccionados.set($event)"
      dataKey="id"
      styleClass="p-datatable-sm tabla-activos"
      currentPageReportTemplate="{first}–{last} de {totalRecords}"
      [showCurrentPageReport]="true"
    >
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 3rem"><p-tableHeaderCheckbox /></th>
          <th style="width: 14rem">Código</th>
          <th>Bien</th>
          <th style="width: 11rem">Serie</th>
          <th style="width: 12rem">Ubicación</th>
          <th style="width: 10rem" class="derecha">Valor de origen</th>
          <th style="width: 9rem" class="centro">Estado</th>
          <th style="width: 4rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-a>
        <tr>
          <td><p-tableCheckbox [value]="a" /></td>

          <td>
            <span class="codigo">{{ a.codigo }}</span>
            <span *ngIf="a.es_bien_control" class="chip-control">control</span>
          </td>

          <td>
            <div class="denominacion">{{ a.denominacion }}</div>
            <div class="marca" *ngIf="a.marca || a.modelo">{{ a.marca }} {{ a.modelo }}</div>
          </td>

          <td><span class="mono">{{ a.serie || '—' }}</span></td>

          <td class="ubicacion">{{ a.ubicacion || '—' }}</td>

          <td class="derecha">
            <span class="monto">{{ a.valor_origen | number: '1.2-2' }}</span>
          </td>

          <td class="centro">
            <p-tag [value]="etiquetaEstado(a.estado)" [severity]="severidadEstado(a.estado)" />
          </td>

          <td class="centro">
            <p-button icon="pi pi-arrow-right" [text]="true" [rounded]="true" size="small"
                      [routerLink]="['/activos/registro', a.id]" pTooltip="Ver ficha" />
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr>
          <td colspan="8">
            <div class="vacio">
              <i class="pi pi-inbox"></i>
              <p class="titulo-vacio">
                {{ hayFiltros() ? 'Sin resultados para estos filtros' : 'Todavía no hay activos registrados' }}
              </p>
              <p-button
                *ngIf="hayFiltros()" label="Limpiar filtros" [text]="true" (onClick)="limpiar()" />
              <p-button
                *ngIf="!hayFiltros()" label="Registrar el primero" icon="pi pi-plus"
                routerLink="/activos/registro/nuevo" />
            </div>
          </td>
        </tr>
      </ng-template>
    </p-table>
  `,
  styles: [`
    :host {
      display: block;
      padding: 1.5rem;
      max-width: 1600px;
      margin: 0 auto;
    }

    /* ---------------------------------------------------------- Encabezado */

    .encabezado {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .encabezado h2 {
      margin: 0;
      font-size: 1.6rem;
      font-weight: 650;
      letter-spacing: -0.02em;
    }

    .subtitulo {
      margin: 0.35rem 0 0;
      font-size: 0.85rem;
      color: var(--text-color-secondary, #6b7280);
    }

    .separador { margin: 0 0.4rem; opacity: 0.5; }

    .acciones { display: flex; gap: 0.5rem; flex-shrink: 0; }

    /* ------------------------------------------------------------- Filtros */

    .filtros {
      display: grid;
      grid-template-columns: minmax(16rem, 2fr) repeat(3, minmax(9rem, 1fr)) auto;
      gap: 0.75rem;
      align-items: center;
      padding: 1rem;
      margin-bottom: 1.25rem;
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #e5e7eb);
      border-radius: 10px;
    }

    @media (max-width: 1100px) {
      .filtros { grid-template-columns: 1fr 1fr; }
      .campo-busqueda { grid-column: 1 / -1; }
    }

    @media (max-width: 640px) {
      .filtros { grid-template-columns: 1fr; }
      .acciones { width: 100%; }
    }

    .campo-busqueda { position: relative; display: block; }

    .campo-busqueda i {
      position: absolute;
      left: 0.85rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-color-secondary, #9ca3af);
      font-size: 0.9rem;
      pointer-events: none;
    }

    .campo-busqueda input { width: 100%; padding-left: 2.4rem; }

    .filtros :is(p-dropdown, .p-dropdown) { width: 100%; }

    /* --------------------------------------------------------------- Tabla */

    .tabla-activos { font-size: 0.9rem; }

    :host ::ng-deep .tabla-activos .p-datatable-thead > tr > th {
      background: var(--surface-ground, #f9fafb);
      font-size: 0.72rem;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-color-secondary, #6b7280);
      border-bottom: 1px solid var(--surface-border, #e5e7eb);
      padding: 0.75rem 1rem;
    }

    :host ::ng-deep .tabla-activos .p-datatable-tbody > tr > td {
      padding: 0.7rem 1rem;
      border-bottom: 1px solid var(--surface-border, #f1f3f5);
    }

    :host ::ng-deep .tabla-activos .p-datatable-tbody > tr:hover {
      background: var(--surface-hover, #f9fafb);
    }

    .derecha { text-align: right; }
    .centro  { text-align: center; }

    /* El código es lo que se lee en la etiqueta: tipografía monoespaciada
       para que los grupos de dígitos se distingan de un vistazo. */
    .codigo {
      font-family: ui-monospace, 'SF Mono', Menlo, monospace;
      font-size: 0.82rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .chip-control {
      display: inline-block;
      margin-left: 0.4rem;
      padding: 0.1rem 0.4rem;
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-color-secondary, #6b7280);
      background: var(--surface-ground, #f3f4f6);
      border-radius: 4px;
    }

    .denominacion { font-weight: 500; line-height: 1.3; }

    .marca {
      font-size: 0.78rem;
      color: var(--text-color-secondary, #9ca3af);
      margin-top: 0.1rem;
    }

    .mono {
      font-family: ui-monospace, 'SF Mono', Menlo, monospace;
      font-size: 0.8rem;
      color: var(--text-color-secondary, #6b7280);
    }

    .ubicacion { font-size: 0.85rem; }

    .monto { font-variant-numeric: tabular-nums; font-weight: 500; }

    /* ---------------------------------------------------------- Sin datos */

    .vacio {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 3.5rem 1rem;
    }

    .vacio i {
      font-size: 2.5rem;
      color: var(--surface-border, #d1d5db);
    }

    .titulo-vacio {
      margin: 0;
      font-size: 0.95rem;
      color: var(--text-color-secondary, #6b7280);
    }
  `],
})
export class ActivoListaComponent implements OnInit {
  private readonly servicio = inject(ActivoService);
  private readonly catalogos = inject(CatalogoService);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);

  readonly activos = signal<ActivoLista[]>([]);
  readonly clases = signal<Clase[]>([]);
  readonly ubicaciones = signal<Ubicacion[]>([]);
  readonly seleccionados = signal<ActivoLista[]>([]);
  readonly cargando = signal(false);
  readonly total = signal(0);

  readonly estados = ESTADOS_ACTIVO;

  filtros: FiltrosActivo = {};
  seleccionadosModel: ActivoLista[] = [];

  ngOnInit(): void {
    this.catalogos.listarClases(true).subscribe((c) => this.clases.set(c));
    this.catalogos.listarUbicaciones(true).subscribe((u) => this.ubicaciones.set(u));
  }

  cargar(evento: TableLazyLoadEvent): void {
    const porPagina = evento.rows ?? 20;
    const pagina = Math.floor((evento.first ?? 0) / porPagina) + 1;

    this.cargando.set(true);

    this.servicio.listar({ ...this.filtros, page: pagina, por_pagina: porPagina }).subscribe({
      next: (r) => {
        this.activos.set(r.data);
        this.total.set(r.meta?.total ?? r.data.length);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo cargar el listado' });
      },
    });
  }

  buscar(): void {
    this.cargar({ first: 0, rows: 20 });
  }

  hayFiltros(): boolean {
    return Object.values(this.filtros).some((v) => v !== null && v !== undefined && v !== '');
  }

  limpiar(): void {
    this.filtros = {};
    this.buscar();
  }

  etiquetaEstado(estado: string): string {
    return ESTADOS_ACTIVO.find((e) => e.valor === estado)?.etiqueta ?? estado;
  }

  severidadEstado(estado: string): SeveridadTag {
    return ESTADOS_ACTIVO.find((e) => e.valor === estado)?.severidad ?? 'secondary';
  }

  imprimirEtiquetas(): void {
    const ids = this.seleccionados().map((a) => a.id);
    this.router.navigate(['/activos/registro/etiquetas'], { queryParams: { ids: ids.join(',') } });
  }
}