import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import {
  Transferencia, TransferenciaDetalle,
} from '../../core/models/transferencia.models';
import { TransferenciaService } from '../../core/services/transferencia.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-transferencia-detalle',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, DecimalPipe, TableModule, ButtonModule,
    DialogModule, InputNumberModule, InputTextareaModule, TooltipModule,
    TienePermisoDirective,
  ],
  template: `
    @if (transferencia(); as t) {
      <header class="pagina">
        <div>
          <h1><span class="codigo">{{ t.numero }}</span></h1>
          <p>{{ t.origen }} → {{ t.destino }} · {{ t.fecha | date:'dd/MM/yyyy' }}</p>
        </div>
        <div class="acciones">
          <button pButton label="Volver" severity="secondary" text
                  routerLink="/transferencias"></button>

          <button pButton icon="pi pi-print" label="Imprimir guía" outlined
                  [loading]="imprimiendo()" (click)="imprimir()"></button>

          @if (t.editable) {
            <button pButton icon="pi pi-pencil" label="Editar" outlined
                    [routerLink]="['/transferencias', t.id, 'editar']"
                    *appTienePermiso="'transferencias.registrar'"></button>

            @if (t.puede_despachar) {
              <button pButton icon="pi pi-send" label="Despachar"
                      [loading]="procesando()" (click)="despachar()"></button>
            }
          }

          @if (t.en_transito && t.puede_recibir) {
            <button pButton icon="pi pi-inbox" label="Registrar recepción"
                    (click)="abrirRecepcion()"></button>
          }

          @if (t.editable || t.en_transito) {
            <button pButton icon="pi pi-ban" label="Anular" severity="danger" outlined
                    *appTienePermiso="'transferencias.anular'"
                    (click)="dialogoAnular = true"></button>
          }
        </div>
      </header>

      @if (t.estado === 'borrador') {
        <div class="aviso" role="status">
          <i class="pi pi-info-circle"></i>
          <span>
            @if (t.puede_despachar) {
              El material <strong>todavía no salió</strong>. Imprima la guía y
              despache cuando el transportista se lo lleve.
            } @else {
              El material todavía no salió. Lo despacha el almacén de origen
              ({{ t.origen }}).
            }
          </span>
        </div>
      }

      @if (t.en_transito) {
        <div class="aviso transito" role="status">
          <i class="pi pi-truck"></i>
          <span>
            <strong>En tránsito.</strong> Salió de {{ t.origen }} el
            {{ t.despachada_en | date:'dd/MM/yyyy HH:mm' }} y todavía no llegó a
            {{ t.destino }}. Mientras tanto no figura en las existencias de
            ninguno de los dos.
            @if (!t.puede_recibir) {
              La recepción la registra {{ t.destino }}.
            }
          </span>
        </div>
      }

      @if (t.estado === 'recibida' && t.tiene_faltantes) {
        <div class="aviso pendiente" role="status">
          <i class="pi pi-exclamation-circle"></i>
          <span>
            Llegó menos material del que salió. La diferencia quedó registrada
            en el detalle y no ingresó al almacén de destino.
          </span>
        </div>
      }

      @if (t.estado === 'anulada') {
        <div class="aviso anulado" role="status">
          <i class="pi pi-times-circle"></i>
          <span>
            Anulada el {{ t.anulada_en | date:'dd/MM/yyyy' }}.
            {{ t.despachada_en ? 'El material volvió al almacén de origen.' : '' }}
            Motivo: {{ t.motivo_anulacion }}
          </span>
        </div>
      }

      <div class="ficha">
        <div><span class="rotulo">Estado</span>
             <span class="estado" [class]="'estado-' + t.estado">{{ t.estado_etiqueta }}</span></div>
        @if (t.transportista) {
          <div><span class="rotulo">Transportista</span>{{ t.transportista }}</div>
        }
        <div><span class="rotulo">Registró</span>{{ t.registrado_por }}</div>
        @if (t.despachada_en) {
          <div><span class="rotulo">Despachó</span>
               {{ t.despachada_por }} — {{ t.despachada_en | date:'dd/MM/yy HH:mm' }}</div>
        }
        @if (t.recibida_en) {
          <div><span class="rotulo">Recibió</span>
               {{ t.recibida_por }} — {{ t.recibida_en | date:'dd/MM/yy HH:mm' }}</div>
        }
      </div>

      @if (t.motivo) {
        <p class="motivo"><span class="rotulo">Motivo</span>{{ t.motivo }}</p>
      }
      @if (t.observacion_recepcion) {
        <p class="motivo"><span class="rotulo">Observación de la recepción</span>
           {{ t.observacion_recepcion }}</p>
      }

      <p-table [value]="t.detalles ?? []" dataKey="id" styleClass="p-datatable-sm">
        <ng-template pTemplate="header">
          <tr>
            <th style="width:9rem">Código</th>
            <th>Producto</th>
            <th style="width:4.5rem">Unidad</th>
            <th style="width:8rem" class="cifra">Despachado</th>
            @if (t.estado === 'recibida') {
              <th style="width:8rem" class="cifra">Recibido</th>
              <th style="width:7rem" class="cifra">Faltante</th>
            }
            <th>Observación</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-d>
          <tr class="marca" [class.marca-bajo]="d.faltante > 0">
            <td><span class="codigo">{{ d.codigo }}</span></td>
            <td>{{ d.producto }}</td>
            <td><span class="codigo">{{ d.unidad }}</span></td>
            <td class="cifra">{{ d.cantidad | number:'1.0-4' }}</td>
            @if (t.estado === 'recibida') {
              <td class="cifra">{{ d.cantidad_recibida | number:'1.0-4' }}</td>
              <td class="cifra" [class.faltante]="d.faltante > 0">
                {{ d.faltante | number:'1.0-4' }}
              </td>
            }
            <td class="tenue">{{ d.observacion || '—' }}</td>
          </tr>
        </ng-template>
      </p-table>

      <!-- ------------------------------------------------- Recepción -->
      <p-dialog header="Registrar la recepción" [(visible)]="dialogoRecepcion"
                [modal]="true" [draggable]="false" [style]="{ width: '40rem' }">
        <p class="nota">
          Confirme cuánto llegó de cada producto. Si algo se rompió o falta en el
          camino, ponga la cantidad real: la diferencia queda documentada y no
          entra al almacén.
        </p>

        <p-table [value]="recepcion()" dataKey="id" styleClass="p-datatable-sm">
          <ng-template pTemplate="header">
            <tr>
              <th>Producto</th>
              <th style="width:7rem" class="cifra">Salió</th>
              <th style="width:9rem" class="cifra">Llegó</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-linea>
            <tr>
              <td>
                <span class="codigo">{{ linea.codigo }}</span>
                {{ linea.producto }}
              </td>
              <td class="cifra tenue">{{ linea.cantidad | number:'1.0-4' }}</td>
              <td>
                <p-inputNumber [(ngModel)]="linea.cantidad_recibida"
                               [ngModelOptions]="{ standalone: true }"
                               [min]="0" [max]="linea.cantidad"
                               [maxFractionDigits]="linea.permite_decimales ? 4 : 0"
                               styleClass="ancho cantidad" />
              </td>
            </tr>
          </ng-template>
        </p-table>

        <div class="campo separado">
          <label>Observación</label>
          <textarea pInputTextarea [(ngModel)]="observacionRecepcion" rows="2"
                    placeholder="Estado del material, diferencias, quién entregó"></textarea>
        </div>

        <div class="pie">
          <button pButton label="Cancelar" severity="secondary" text
                  (click)="dialogoRecepcion = false"></button>
          <button pButton label="Confirmar recepción" icon="pi pi-check"
                  [loading]="procesando()" (click)="recibir()"></button>
        </div>
      </p-dialog>

      <!-- ---------------------------------------------------- Anular -->
      <p-dialog header="Anular transferencia" [(visible)]="dialogoAnular" [modal]="true"
                [draggable]="false" [style]="{ width: '30rem' }">
        <p class="nota">
          @if (t.en_transito) {
            El material volverá al almacén de origen con sus costos originales.
          } @else {
            Este borrador no movió existencias, así que solo queda cerrado.
          }
        </p>

        <div class="campo">
          <label>Motivo</label>
          <textarea pInputTextarea [(ngModel)]="motivo" rows="3"
                    placeholder="Por qué se anula"></textarea>
        </div>

        <div class="pie">
          <button pButton label="Cancelar" severity="secondary" text
                  (click)="dialogoAnular = false"></button>
          <button pButton label="Anular transferencia" severity="danger"
                  [loading]="procesando()" (click)="anular()"></button>
        </div>
      </p-dialog>
    }
  `,
  styles: [`
    .pagina h1 { font-size:var(--t-md); }

    .aviso { display:flex; align-items:flex-start; gap:.625rem; padding:.75rem .875rem;
             margin-bottom:1rem; border:1px solid var(--linea);
             border-left:3px solid var(--acento); border-radius:var(--radio);
             background:var(--acento-lavado); font-size:var(--t-sm);
             line-height:1.5; max-width:80ch; }
    .aviso i { color:var(--acento); margin-top:.125rem; }
    .aviso span { flex:1; }
    .aviso.transito { border-left-color:var(--aviso); background:var(--aviso-lavado); }
    .aviso.transito i { color:var(--aviso); }
    .aviso.pendiente { border-left-color:var(--aviso); background:var(--aviso-lavado); }
    .aviso.pendiente i { color:var(--aviso); }
    .aviso.anulado { border-left-color:var(--alerta); background:var(--alerta-lavado); }
    .aviso.anulado i { color:var(--alerta); }

    .ficha { display:grid; grid-template-columns:repeat(auto-fit, minmax(13rem, 1fr));
             gap:.875rem 1.5rem; padding:1rem 0 1.25rem;
             border-bottom:1px solid var(--linea-tenue); margin-bottom:1.25rem; }
    .ficha > div { display:flex; flex-direction:column; gap:.125rem;
                   font-size:var(--t-sm); }
    .rotulo { font-size:var(--t-xs); color:var(--tinta-suave); }

    .motivo { display:flex; flex-direction:column; gap:.125rem; font-size:var(--t-sm);
              max-width:70ch; margin:0 0 1.25rem; }

    .estado { align-self:flex-start; padding:.0625rem .4375rem; border-radius:2px;
              font-size:var(--t-xs); border:1px solid var(--linea);
              color:var(--tinta-suave); }
    .estado-despachada { border-color:var(--aviso); color:var(--aviso);
                         background:var(--aviso-lavado); }
    .estado-recibida { border-color:var(--bien); color:var(--bien); }
    .estado-anulada { border-color:var(--alerta); color:var(--alerta); }

    .faltante { color:var(--aviso); font-weight:500; }
    .tenue { color:var(--tinta-suave); }

    .nota { font-size:var(--t-sm); color:var(--tinta-suave); margin:0 0 1rem;
            line-height:1.5; }
    .campo textarea { width:100%; }
    .separado { margin-top:1rem; }
    :host ::ng-deep .ancho { width:100%; }
    :host ::ng-deep .cantidad input { text-align:right;
                                      font-variant-numeric:tabular-nums; }

    .pie { display:flex; justify-content:flex-end; gap:.5rem; margin-top:1.25rem;
           padding-top:1rem; border-top:1px solid var(--linea-tenue); }
  `],
})
export class TransferenciaDetalleComponent implements OnInit {
  private readonly servicio = inject(TransferenciaService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);
  private readonly confirmacion = inject(ConfirmationService);

  readonly id = input.required<string>();

  readonly transferencia = signal<Transferencia | null>(null);
  readonly recepcion = signal<TransferenciaDetalle[]>([]);
  readonly procesando = signal(false);
  readonly imprimiendo = signal(false);

  dialogoAnular = false;
  dialogoRecepcion = false;
  motivo = '';
  observacionRecepcion = '';

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.servicio.obtener(Number(this.id()))
      .subscribe(res => this.transferencia.set(res.data));
  }

  /** El momento en que el material sale del almacén de origen. */
  despachar(): void {
    const t = this.transferencia();
    if (!t) return;

    this.confirmacion.confirm({
      header: 'Despachar la transferencia',
      message: `El material saldrá de ${t.origen} y quedará en tránsito hasta `
             + `que ${t.destino} registre la recepción. Hágalo cuando el `
             + 'transportista se lo lleve.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Despachar',
      rejectLabel: 'Todavía no',
      accept: () => {
        this.procesando.set(true);

        this.servicio.despachar(Number(this.id())).subscribe({
          next: res => {
            this.transferencia.set(res.data);
            this.procesando.set(false);
            this.mensajes.add({
              severity: 'success',
              summary: 'Transferencia despachada',
              detail: `El material está en camino a ${t.destino}.`,
            });
          },
          error: (error: HttpErrorResponse) => {
            this.procesando.set(false);
            if (error.status === 409 || error.status === 403) {
              this.mensajes.add({
                severity: 'error',
                summary: 'No se pudo despachar',
                detail: error.error?.message,
                life: 10_000,
              });
            }
          },
        });
      },
    });
  }

  abrirRecepcion(): void {
    // Se precarga lo despachado: lo normal es que llegue todo.
    this.recepcion.set((this.transferencia()?.detalles ?? []).map(d => ({
      ...d,
      cantidad_recibida: d.cantidad,
    })));

    this.observacionRecepcion = '';
    this.dialogoRecepcion = true;
  }

  recibir(): void {
    this.procesando.set(true);

    this.servicio.recibir(Number(this.id()), {
      observacion: this.observacionRecepcion || null,
      detalles: this.recepcion().map(d => ({
        id: d.id!,
        cantidad_recibida: d.cantidad_recibida ?? 0,
      })),
    }).subscribe({
      next: res => {
        this.transferencia.set(res.data);
        this.dialogoRecepcion = false;
        this.procesando.set(false);
        this.mensajes.add({
          severity: 'success',
          summary: 'Recepción registrada',
          detail: 'El material ya está disponible en este almacén.',
        });
      },
      error: (error: HttpErrorResponse) => {
        this.procesando.set(false);
        this.mensajes.add({
          severity: 'error',
          summary: 'No se pudo registrar',
          detail: error.error?.message,
        });
      },
    });
  }

  anular(): void {
    if (!this.motivo.trim()) {
      this.mensajes.add({
        severity: 'warn',
        summary: 'Falta el motivo',
        detail: 'Escriba por qué se anula la transferencia.',
      });
      return;
    }

    this.procesando.set(true);

    this.servicio.anular(Number(this.id()), this.motivo).subscribe({
      next: res => {
        this.transferencia.set(res.data);
        this.dialogoAnular = false;
        this.procesando.set(false);
        this.mensajes.add({ severity: 'success', summary: 'Transferencia anulada' });
      },
      error: (error: HttpErrorResponse) => {
        this.procesando.set(false);
        if (error.status === 409) {
          this.mensajes.add({
            severity: 'error',
            summary: 'No se pudo anular',
            detail: error.error?.message,
            life: 10_000,
          });
        }
      },
    });
  }

  imprimir(): void {
    this.imprimiendo.set(true);

    this.servicio.descargarGuia(Number(this.id())).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        this.imprimiendo.set(false);
      },
      error: () => this.imprimiendo.set(false),
    });
  }
}
