import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DropdownModule } from 'primeng/dropdown';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { mensajeDeError } from '../../cargas/core/errores';
import { PermisosService } from '../../core/services/permisos.service';
import { abrirPdf, nombreDe } from '../core/archivos';
import { Caja, SesionFila } from '../core/caja.model';
import { CajaService } from '../core/caja.service';
import { DineroPipe } from '../core/dinero';
import { ESTILOS_CAJA } from '../core/estilos';

/**
 * Historial de cierres de caja: lo esperado, lo contado y la diferencia de
 * cada día. El supervisor valida desde aquí los cierres de otros cajeros.
 */
@Component({
  selector: 'app-cierres-caja',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, DropdownModule, ConfirmDialogModule, ToastModule,
            TooltipModule, DineroPipe],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <header class="encabezado">
      <div>
        <h2>Cierres de caja</h2>
        <p class="subtitulo">Cada sesión con su efectivo esperado, contado y la diferencia. Los cierres se validan
          por otra persona: quien cerró no puede validar el suyo.</p>
      </div>
    </header>

    <div class="barra">
      <p-dropdown class="filtro" [options]="cajas()" [(ngModel)]="cajaId" optionLabel="nombre" optionValue="id"
                  placeholder="Todas las cajas" [showClear]="true" (onChange)="recargar()" />
      <p-dropdown class="filtro" [options]="estados" [(ngModel)]="estado" optionLabel="etiqueta" optionValue="valor"
                  placeholder="Todos los estados" [showClear]="true" (onChange)="recargar()" />
    </div>

    <p-table [value]="sesiones()" [lazy]="true" (onLazyLoad)="cargar($event)" [paginator]="true" [rows]="25"
             [totalRecords]="total()" [loading]="cargando()" dataKey="id" styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 10rem">Caja · sesión</th>
          <th style="width: 9rem">Día</th>
          <th>Cajero</th>
          <th style="width: 10rem" class="derecha">Esperado</th>
          <th style="width: 10rem" class="derecha">Contado</th>
          <th style="width: 10rem" class="derecha">Diferencia</th>
          <th style="width: 12rem">Estado</th>
          <th style="width: 7rem"></th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-s>
        <tr>
          <td><span class="codigo">{{ s.caja?.codigo }}</span> · {{ s.numero }}</td>
          <td>{{ s.abierta_en | date: 'dd/MM/yyyy' }}</td>
          <td>
            {{ nombre(s.cerrada_por) || nombre(s.abierta_por) }}
            <div class="secundario" *ngIf="s.observaciones" [pTooltip]="s.observaciones">{{ s.observaciones | slice: 0:60 }}{{ s.observaciones.length > 60 ? '…' : '' }}</div>
          </td>
          <td class="derecha"><div class="monto" *ngFor="let x of s.saldos">{{ x.saldo_esperado | dinero: x.moneda }}</div></td>
          <td class="derecha"><div class="monto" *ngFor="let x of s.saldos">{{ x.saldo_contado | dinero: x.moneda }}</div></td>
          <td class="derecha">
            <div *ngFor="let x of s.saldos" class="monto"
                 [class.egreso]="+(x.diferencia ?? 0) < 0" [class.sobra]="+(x.diferencia ?? 0) > 0">
              <ng-container *ngIf="x.diferencia === null">—</ng-container>
              <ng-container *ngIf="x.diferencia !== null && +x.diferencia === 0">Cuadra</ng-container>
              <ng-container *ngIf="x.diferencia !== null && +x.diferencia !== 0">
                {{ +x.diferencia > 0 ? 'Sobra' : 'Falta' }} {{ abs(x.diferencia) | dinero: x.moneda }}
              </ng-container>
            </div>
          </td>
          <td>
            <span class="pastilla" [class.pastilla-ok]="s.estado === 'VALIDADA'" [class.pastilla-aviso]="s.estado === 'CERRADA'"
                  [class.pastilla-acento]="s.estado === 'ABIERTA'">{{ etiquetaEstado(s.estado) }}</span>
            <div class="secundario" *ngIf="s.estado === 'VALIDADA'">por {{ nombre(s.validada_por) }}</div>
          </td>
          <td class="centro">
            <p-button icon="pi pi-file-pdf" [text]="true" [rounded]="true" size="small" pTooltip="Reporte del día"
                      (onClick)="reporte(s)" />
            <p-button *ngIf="s.estado === 'CERRADA' && puedeValidar" icon="pi pi-check" [text]="true" [rounded]="true"
                      size="small" severity="success" pTooltip="Validar cierre" (onClick)="validar(s)" />
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="8"><div class="vacio"><i class="pi pi-inbox"></i>
          <div class="titulo-vacio">Sin sesiones con esos filtros</div></div></td></tr>
      </ng-template>
    </p-table>
  `,
  styles: [...ESTILOS_CAJA, `.sobra { color: #b45309; }`],
})
export class CierresCajaComponent implements OnInit {
  private readonly servicio = inject(CajaService);
  private readonly toast = inject(MessageService);
  private readonly confirmar = inject(ConfirmationService);
  readonly puedeValidar = inject(PermisosService).can('caja.validar');

  readonly sesiones = signal<SesionFila[]>([]);
  readonly cajas = signal<Caja[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(false);

  cajaId: number | null = null;
  estado: string | null = null;
  private pagina = 1;

  readonly estados = [
    { valor: 'CERRADA', etiqueta: 'Por validar' },
    { valor: 'VALIDADA', etiqueta: 'Validadas' },
    { valor: 'ABIERTA', etiqueta: 'Abiertas' },
  ];

  readonly nombre = nombreDe;

  ngOnInit(): void {
    this.servicio.listar().subscribe((c) => this.cajas.set(c));
    if (this.puedeValidar) this.estado = 'CERRADA';
  }

  cargar(e: TableLazyLoadEvent): void {
    this.pagina = Math.floor((e.first ?? 0) / (e.rows ?? 25)) + 1;
    this.pedir();
  }

  recargar(): void {
    this.pagina = 1;
    this.pedir();
  }

  private pedir(): void {
    const filtros: Record<string, string | number> = {};
    if (this.cajaId) filtros['caja_id'] = this.cajaId;
    if (this.estado) filtros['estado'] = this.estado;
    this.cargando.set(true);
    this.servicio.sesiones(filtros, this.pagina).subscribe({
      next: (r) => { this.sesiones.set(r.data); this.total.set(r.total); this.cargando.set(false); },
      error: (e) => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo cargar la lista', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }

  abs(v: string | null): number { return Math.abs(Number(v ?? 0)); }

  etiquetaEstado(e: string): string {
    return e === 'VALIDADA' ? 'Validada' : e === 'CERRADA' ? 'Cerrada · por validar' : 'Abierta';
  }

  reporte(s: SesionFila): void {
    this.servicio.reporteSesion(s.id).subscribe({
      next: abrirPdf,
      error: () => this.toast.add({ severity: 'error', summary: 'No se pudo generar el reporte' }),
    });
  }

  validar(s: SesionFila): void {
    this.confirmar.confirm({
      header: `Validar el cierre ${s.caja?.codigo} · sesión ${s.numero}`,
      message: 'Confirme que revisó el reporte del día y recibió el efectivo contado. La validación no se deshace.',
      acceptLabel: 'Validar', rejectLabel: 'Cancelar', icon: 'pi pi-check-circle',
      accept: () => this.servicio.validar(s.id).subscribe({
        next: (r) => { this.toast.add({ severity: 'success', summary: r.mensaje ?? 'Validado' }); this.pedir(); },
        error: (e) => this.toast.add({ severity: 'error', summary: 'No se validó', detail: mensajeDeError(e), life: 8000 }),
      }),
    });
  }
}
