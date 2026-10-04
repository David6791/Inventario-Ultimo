import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DocumentoService } from '../core/services/documento.service';
import {
  Documento, ESTADOS_DOCUMENTO, FiltrosDocumento, SeveridadTag,
  TIPOS_DOCUMENTO, etiquetaEstadoDoc, etiquetaTipo, severidadEstadoDoc,
} from '../core/models/documento.model';
import { ESTILOS_CONFIG } from '../core/estilos/configuracion.estilos';

@Component({
  selector: 'app-documento-lista',
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
        <h2>Custodia de bienes</h2>
        <p class="subtitulo">
          Asignaciones, traspasos, salidas temporales y devoluciones.
          Un documento en borrador no afecta al bien: solo al confirmarlo cambia su estado.
        </p>
      </div>
      <div class="acciones">
        <p-button label="Nuevo documento" icon="pi pi-plus" routerLink="/activos/custodia/nuevo" />
      </div>
    </header>

    <div class="atajos" *ngIf="vencidos() > 0">
      <div class="nota nota-aviso">
        <i class="pi pi-clock"></i>
        <span>
          Hay <strong>{{ vencidos() }}</strong> salida(s) temporal(es) con el plazo de retorno
          vencido.
        </span>
        <button class="enlace" type="button" (click)="filtrarVencidos()">Ver cuáles</button>
      </div>
    </div>

    <div class="barra">
      <span class="campo-busqueda">
        <i class="pi pi-search"></i>
        <input pInputText placeholder="Número de documento…"
               [(ngModel)]="filtros.buscar" (keyup.enter)="buscar()" />
      </span>

      <div class="filtro">
        <p-dropdown [options]="tipos" optionLabel="etiqueta" optionValue="valor"
                    placeholder="Tipo" [showClear]="true" appendTo="body"
                    [(ngModel)]="filtros.tipo" (onChange)="buscar()" />
      </div>

      <div class="filtro">
        <p-dropdown [options]="estados" optionLabel="etiqueta" optionValue="valor"
                    placeholder="Estado" [showClear]="true" appendTo="body"
                    [(ngModel)]="filtros.estado" (onChange)="buscar()" />
      </div>

      <p-button label="Limpiar" icon="pi pi-filter-slash" [text]="true"
                [disabled]="!hayFiltros()" (onClick)="limpiar()" />
    </div>

    <p-table [value]="documentos()" [lazy]="true" (onLazyLoad)="cargar($event)"
             [loading]="cargando()" [paginator]="true" [rows]="20"
             [totalRecords]="total()" dataKey="id" styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 15rem">Documento</th>
          <th style="width: 11rem">Tipo</th>
          <th style="width: 7rem" class="centro">Bienes</th>
          <th>Detalle</th>
          <th style="width: 8rem">Fecha</th>
          <th style="width: 8rem" class="centro">Estado</th>
          <th style="width: 4rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-d>
        <tr [class.fila-vencida]="d.salida?.vencido">
          <td><span class="codigo">{{ d.numero }}</span></td>
          <td>{{ etiquetaTipo(d.tipo) }}</td>
          <td class="centro numero">{{ d.cantidad_activos ?? d.activos?.length ?? 0 }}</td>

          <td class="secundario">
            <ng-container *ngIf="d.tipo === 'SALIDA_TEMPORAL' && d.salida; else otroDetalle">
              {{ d.salida.destino }}
              <span *ngIf="d.salida.retorno_real">
                · retornó el {{ d.salida.retorno_real | date: 'dd/MM/yyyy' }}
              </span>
              <span *ngIf="!d.salida.retorno_real && d.salida.retorno_comprometido"
                    [class.vencido]="d.salida.vencido">
                · retorno {{ d.salida.retorno_comprometido | date: 'dd/MM/yyyy' }}
              </span>
            </ng-container>
            <ng-template #otroDetalle>{{ d.motivo || '—' }}</ng-template>
          </td>

          <td class="numero">{{ d.fecha | date: 'dd/MM/yyyy' }}</td>

          <td class="centro">
            <p-tag [value]="etiquetaEstadoDoc(d.estado)" [severity]="severidadEstadoDoc(d.estado)" />
          </td>

          <td class="centro">
            <p-button icon="pi pi-arrow-right" [text]="true" [rounded]="true" size="small"
                      [routerLink]="['/activos/custodia', d.id]" />
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="7">
          <div class="vacio">
            <i class="pi pi-file"></i>
            <p class="titulo-vacio">
              {{ hayFiltros() ? 'Sin documentos para estos filtros' : 'Todavía no hay documentos de custodia' }}
            </p>
            <p-button *ngIf="!hayFiltros()" label="Emitir el primero" icon="pi pi-plus"
                      routerLink="/activos/custodia/nuevo" />
          </div>
        </td></tr>
      </ng-template>
    </p-table>
  `,
  styles: [ESTILOS_CONFIG, `
    .atajos { margin-bottom: 1rem; }

    .enlace {
      margin-left: auto; padding: 0;
      font-size: 0.82rem; font-weight: 600;
      color: inherit; background: none; border: none;
      text-decoration: underline; cursor: pointer;
    }

    .fila-vencida { background: #fffbf5; }
    .vencido { color: #b45309; font-weight: 600; }
  `],
})
export class DocumentoListaComponent implements OnInit {
  private readonly servicio = inject(DocumentoService);
  private readonly toast = inject(MessageService);

  readonly documentos = signal<Documento[]>([]);
  readonly cargando = signal(false);
  readonly total = signal(0);
  readonly vencidos = signal(0);

  readonly tipos = TIPOS_DOCUMENTO;
  readonly estados = ESTADOS_DOCUMENTO;

  readonly etiquetaTipo = etiquetaTipo;
  readonly etiquetaEstadoDoc = etiquetaEstadoDoc;
  readonly severidadEstadoDoc = severidadEstadoDoc;

  filtros: FiltrosDocumento = {};

  ngOnInit(): void {
    this.contarVencidos();
  }

  cargar(evento: TableLazyLoadEvent): void {
    const porPagina = evento.rows ?? 20;
    const pagina = Math.floor((evento.first ?? 0) / porPagina) + 1;

    this.cargando.set(true);

    this.servicio.listar({ ...this.filtros, page: pagina, por_pagina: porPagina }).subscribe({
      next: (r) => {
        this.documentos.set(r.data);
        this.total.set(r.meta?.total ?? r.data.length);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo cargar el listado' });
      },
    });
  }

  /** Aviso de salidas vencidas: lo que más se pierde de vista. */
  private contarVencidos(): void {
    this.servicio.listar({ solo_vencidos: true, por_pagina: 1 }).subscribe({
      next: (r) => this.vencidos.set(r.meta?.total ?? 0),
    });
  }

  filtrarVencidos(): void {
    this.filtros = { tipo: 'SALIDA_TEMPORAL', solo_vencidos: true };
    this.buscar();
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
}
