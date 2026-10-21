import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import { mensajeDeError } from '../../cargas/core/errores';
import { SolicitudConUsuarios } from '../core/caja.model';
import { CajaService } from '../core/caja.service';
import { DineroPipe } from '../core/dinero';
import { ESTILOS_CAJA } from '../core/estilos';
import { ESTILOS_SOLICITUD, detalleEstado, etiquetaEstado, nombreUsuario } from './estado-solicitud';

/**
 * Bandeja del aprobador: las solicitudes pendientes de las cajas que tiene
 * asignadas. Aprobar deja la solicitud lista para que la cajera pague;
 * rechazar exige el motivo, que ve el solicitante.
 */
@Component({
  selector: 'app-aprobaciones-caja',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, DialogModule, InputTextareaModule, SelectButtonModule, TableModule,
    ToastModule, TooltipModule, DineroPipe,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Aprobación de solicitudes</h2>
        <p class="subtitulo">
          Solicitudes de dinero de las cajas que usted aprueba{{ cajas().length ? ': ' + codigos() : '' }}.
          Al aprobar, la cajera puede entregar el dinero; si rechaza, el solicitante ve el motivo.
        </p>
      </div>
      <div class="acciones">
        <p-selectButton [options]="vistas" [(ngModel)]="vista" optionLabel="etiqueta" optionValue="valor"
                        (onChange)="cargar()" />
      </div>
    </header>

    <div class="nota nota-aviso nota-encabezado" *ngIf="cargado() && !cajas().length">
      <i class="pi pi-exclamation-triangle"></i>
      <span>No está asignado como aprobador de ninguna caja. El administrador lo asigna en Caja → Cajas.</span>
    </div>

    <p-table [value]="solicitudes()" [loading]="cargando()" dataKey="id" styleClass="p-datatable-sm tabla"
             [paginator]="solicitudes().length > 20" [rows]="20">
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 10rem">Solicitud</th>
          <th style="width: 7rem">Caja</th>
          <th style="width: 15rem">Quién pide</th>
          <th>Para qué</th>
          <th style="width: 9rem" class="derecha">Monto</th>
          <th [style.width]="vista === 'PENDIENTE' ? '13rem' : '14rem'">{{ vista === 'PENDIENTE' ? '' : 'Resultado' }}</th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-s>
        <tr>
          <td>
            <div class="codigo">{{ s.numero }}</div>
            <div class="secundario">{{ s.registrado_en | date: 'dd/MM/yyyy HH:mm' }}</div>
          </td>
          <td><span class="codigo">{{ s.caja?.codigo }}</span></td>
          <td>
            <div>{{ s.persona_nombre }}</div>
            <div class="secundario">{{ s.persona_ci ? 'CI ' + s.persona_ci + ' · ' : '' }}registró {{ usuario(s.registrado_por) }}</div>
          </td>
          <td>
            <div>{{ s.concepto?.nombre }}</div>
            <div class="secundario">{{ s.glosa }}</div>
          </td>
          <td class="derecha monto fuerte">{{ s.monto | dinero: s.moneda }}</td>
          <td *ngIf="vista === 'PENDIENTE'">
            <div class="botones" *ngIf="!s.es_mia; else propia">
              <p-button label="Aprobar" icon="pi pi-check" size="small" severity="success" (onClick)="resolver(s, 'aprobar')" />
              <p-button label="Rechazar" icon="pi pi-times" size="small" severity="danger" [outlined]="true"
                        (onClick)="resolver(s, 'rechazar')" />
            </div>
            <ng-template #propia>
              <span class="secundario" pTooltip="Nadie aprueba una solicitud que registró o que es a su nombre">
                <i class="pi pi-lock"></i> Es suya: la aprueba otro aprobador
              </span>
            </ng-template>
          </td>
          <td *ngIf="vista !== 'PENDIENTE'">
            <span class="pastilla" [ngClass]="'estado-' + s.estado">{{ etiqueta(s.estado) }}</span>
            <div class="secundario detalle-estado">{{ s.resuelto_en | date: 'dd/MM/yyyy HH:mm' }}
              {{ s.estado === 'PAGADA' ? '· ' + (s.movimiento?.numero ?? '') : (s.observacion ? '· ' + s.observacion : '') }}</div>
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="6">
          <div class="vacio">
            <i class="pi" [ngClass]="vista === 'PENDIENTE' ? 'pi-check-circle' : 'pi-history'"></i>
            <div class="titulo-vacio">{{ vista === 'PENDIENTE' ? 'No hay solicitudes por aprobar' : 'Todavía no resolvió solicitudes' }}</div>
          </div>
        </td></tr>
      </ng-template>
    </p-table>

    <p-dialog [(visible)]="dialogoVisible" [header]="accion === 'aprobar' ? 'Aprobar solicitud' : 'Rechazar solicitud'"
              [modal]="true" [style]="{ width: '32rem' }" [draggable]="false">
      <ng-container *ngIf="actual() as s">
        <p class="explicacion">
          <strong class="codigo">{{ s.numero }}</strong> · {{ s.persona_nombre }} pide
          <strong>{{ s.monto | dinero: s.moneda }}</strong> de la caja {{ s.caja?.codigo }} para «{{ s.glosa }}».
        </p>
        <div class="campos">
          <div class="campo span-6">
            <label for="observacion">{{ accion === 'aprobar' ? 'Observación (opcional)' : 'Motivo del rechazo' }}</label>
            <textarea id="observacion" pInputTextarea [(ngModel)]="observacion" rows="3" maxlength="250"></textarea>
            <small *ngIf="accion === 'rechazar'">El solicitante lo ve en su lista.</small>
          </div>
        </div>
      </ng-container>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="dialogoVisible = false" />
        <p-button [label]="accion === 'aprobar' ? 'Aprobar' : 'Rechazar'" [icon]="accion === 'aprobar' ? 'pi pi-check' : 'pi pi-times'"
                  [severity]="accion === 'aprobar' ? 'success' : 'danger'" [loading]="enviando()"
                  [disabled]="enviando() || (accion === 'rechazar' && observacion.trim().length < 5)" (onClick)="confirmar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [...ESTILOS_CAJA, ESTILOS_SOLICITUD, `
    .botones { display: flex; gap: 0.4rem; }
    .fuerte { font-weight: 700; }
    .explicacion { font-size: 0.9rem; line-height: 1.5; margin-top: 0; }
  `],
})
export class AprobacionesCajaComponent implements OnInit {
  private readonly servicio = inject(CajaService);
  private readonly toast = inject(MessageService);

  readonly solicitudes = signal<SolicitudConUsuarios[]>([]);
  readonly cajas = signal<{ id: number; codigo: string; nombre: string }[]>([]);
  readonly cargando = signal(false);
  readonly cargado = signal(false);
  readonly enviando = signal(false);
  readonly actual = signal<SolicitudConUsuarios | null>(null);

  readonly vistas = [{ valor: 'PENDIENTE', etiqueta: 'Por aprobar' }, { valor: 'RESUELTAS', etiqueta: 'Resueltas por mí' }];
  vista: 'PENDIENTE' | 'RESUELTAS' = 'PENDIENTE';
  dialogoVisible = false;
  accion: 'aprobar' | 'rechazar' = 'aprobar';
  observacion = '';

  readonly etiqueta = etiquetaEstado;
  readonly detalle = detalleEstado;
  readonly usuario = nombreUsuario;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.porAprobar(this.vista ?? 'PENDIENTE').subscribe({
      next: (r) => { this.solicitudes.set(r.data); this.cajas.set(r.cajas); this.cargando.set(false); this.cargado.set(true); },
      error: (e) => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo cargar la bandeja', detail: mensajeDeError(e), life: 9000 });
      },
    });
  }

  codigos(): string {
    return this.cajas().map((c) => c.codigo).join(', ');
  }

  resolver(s: SolicitudConUsuarios, accion: 'aprobar' | 'rechazar'): void {
    this.actual.set(s);
    this.accion = accion;
    this.observacion = '';
    this.dialogoVisible = true;
  }

  confirmar(): void {
    const s = this.actual();
    if (!s) return;
    this.enviando.set(true);
    const texto = this.observacion.trim() || null;
    const pedido = this.accion === 'aprobar'
      ? this.servicio.aprobarSolicitud(s.id, texto)
      : this.servicio.rechazarSolicitud(s.id, texto ?? '');
    pedido.subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.dialogoVisible = false;
        this.toast.add({ severity: 'success', summary: r.mensaje ?? 'Listo' });
        this.cargar();
      },
      error: (e) => {
        this.enviando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo', detail: mensajeDeError(e), life: 9000 });
      },
    });
  }
}
