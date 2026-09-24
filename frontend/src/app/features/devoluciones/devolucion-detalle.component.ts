import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import {
  Devolucion, DevolucionDetalle, MOTIVOS_DEVOLUCION,
} from '../../core/models/devolucion.models';
import { DevolucionService } from '../../core/services/devolucion.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-devolucion-detalle',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, DecimalPipe, TableModule, ButtonModule,
    DialogModule, ConfirmDialogModule, FileUploadModule, InputTextareaModule,
    TooltipModule, TienePermisoDirective,
  ],
  providers: [ConfirmationService],
  template: `
    <p-confirmDialog />

    @if (devolucion(); as d) {
      <header class="pagina">
        <div>
          <div class="titulo">
            <h1>{{ d.numero }}</h1>
            <span class="estado" [class]="'estado-' + d.estado">
              {{ d.estado === 'registrada' ? 'Registrada' : 'Anulada' }}
            </span>
          </div>
          <p>
            Devolución contra la salida
            <a class="codigo enlace" [routerLink]="['/salidas', d.salida_id]">{{ d.salida_numero }}</a>
          </p>
        </div>

        <div class="acciones">
          <button pButton icon="pi pi-print" label="Nota" outlined
                  (click)="imprimir()"></button>

          @if (d.estado === 'registrada') {
            @if (!d.nota_firmada) {
              <button pButton icon="pi pi-upload" label="Subir nota firmada" outlined
                      (click)="subiendo.set(true)"
                      *appTienePermiso="'devoluciones.crear'"></button>
            }

            <button pButton icon="pi pi-times" label="Anular" outlined severity="danger"
                    (click)="confirmarAnulacion()"
                    *appTienePermiso="'devoluciones.anular'"></button>
          }
        </div>
      </header>

      @if (d.estado === 'anulada') {
        <p class="aviso alerta">
          <i class="pi pi-ban"></i>
          <span>
            Esta devolución fue anulada. El material volvió a descontarse del stock.
            <strong>Motivo:</strong> {{ d.motivo_anulacion }}
          </span>
        </p>
      } @else if (!d.nota_firmada) {
        <p class="aviso">
          <i class="pi pi-exclamation-circle"></i>
          Falta adjuntar la nota firmada por quien entregó el material.
        </p>
      }

      <!-- Cabecera -->
      <section class="tarjeta">
        <div class="datos">
          <div>
            <span class="rotulo">Fecha</span>
            <strong>{{ d.fecha | date:'dd/MM/yyyy' }}</strong>
          </div>
          <div>
            <span class="rotulo">Unidad solicitante</span>
            <strong>{{ d.unidad_nombre ?? '—' }}</strong>
          </div>
          <div>
            <span class="rotulo">Solicitante</span>
            <strong>{{ d.solicitante_nombre ?? '—' }}</strong>
          </div>
          <div>
            <span class="rotulo">Motivo</span>
            <strong>{{ etiquetaMotivo(d.motivo) }}</strong>
          </div>
          <div class="destacado">
            <span class="rotulo">Costo devuelto</span>
            <strong class="importe">{{ d.costo_total | number:'1.2-2' }}</strong>
            <span class="unidad-medida">Bs</span>
          </div>
        </div>

        @if (d.observaciones) {
          <p class="observaciones">{{ d.observaciones }}</p>
        }
      </section>

      <!-- Detalle -->
      <section class="tarjeta">
        <h2>Ítems devueltos</h2>

        <p-table [value]="detalles()" dataKey="id" styleClass="p-datatable-sm"
                 [expandedRowKeys]="expandidas">
          <ng-template pTemplate="header">
            <tr>
              <th style="width:3rem"></th>
              <th style="width:9rem">Código</th>
              <th>Producto</th>
              <th style="width:8rem" class="cifra">Cantidad</th>
              <th style="width:9rem" class="cifra">Costo unit.</th>
              <th style="width:10rem" class="cifra">Costo Bs</th>
              <th style="width:8rem">Estado</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-l let-expandida="expanded">
            <tr>
              <td>
                <button pButton [pRowToggler]="l" text rounded
                        [icon]="expandida ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
                        pTooltip="Ver a qué capas se restituyó"></button>
              </td>
              <td><span class="codigo">{{ l.producto_codigo }}</span></td>
              <td>
                {{ l.producto_nombre }}
                @if (l.observaciones) {
                  <div class="persona">{{ l.observaciones }}</div>
                }
              </td>
              <td class="cifra">
                {{ l.cantidad | number:'1.0-4' }}
                <span class="tenue">{{ l.unidad_medida }}</span>
              </td>
              <td class="cifra importe tenue">
                {{ costoUnitario(l) | number:'1.2-4' }}
              </td>
              <td class="cifra importe"><strong>{{ l.costo_total | number:'1.2-2' }}</strong></td>
              <td>
                @if (l.estado_bien === 'danado') {
                  <span class="marca-danado" pTooltip="No se repuso al stock disponible">Dañado</span>
                } @else {
                  <span class="tenue">Bueno</span>
                }
              </td>
            </tr>
          </ng-template>

          <!--
            La expansión muestra las capas: es la prueba de que la devolución
            se valorizó al costo con que el material salió, no al de hoy.
          -->
          <ng-template pTemplate="rowexpansion" let-l>
            <tr class="expansion">
              <td colspan="7">
                <div class="capas">
                  <h3>Restitución por capa</h3>

                  <table class="tabla-capas">
                    <thead>
                      <tr>
                        <th>Capa</th>
                        <th class="cifra">Cantidad</th>
                        <th class="cifra">Costo unitario</th>
                        <th class="cifra">Subtotal Bs</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (c of l.consumos ?? []; track c.id) {
                        <tr>
                          <td><span class="codigo">#{{ c.capa_id }}</span></td>
                          <td class="cifra">{{ c.cantidad | number:'1.0-4' }}</td>
                          <td class="cifra importe">{{ c.costo_unitario | number:'1.2-4' }}</td>
                          <td class="cifra importe">{{ c.costo_total | number:'1.2-2' }}</td>
                        </tr>
                      } @empty {
                        <tr><td colspan="4" class="tenue">Sin detalle de capas.</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>

        <div class="total-pie">
          <span class="rotulo">Total devuelto</span>
          <strong class="importe">{{ d.costo_total | number:'1.2-2' }} Bs</strong>
        </div>
      </section>
    }

    <!-- Modal: nota firmada -->
    <p-dialog header="Subir la nota firmada" [(visible)]="subiendoModal"
              [modal]="true" [style]="{ width: '28rem' }" (onHide)="subiendo.set(false)">
      <p class="texto-modal">
        Imprima la nota, hágala firmar por quien entrega el material, escanéela
        y adjúntela acá. El archivo queda como respaldo de la devolución.
      </p>

      <p-fileUpload mode="basic" accept="application/pdf,image/*" [maxFileSize]="5242880"
                    chooseLabel="Elegir archivo" [auto]="false" [customUpload]="true"
                    (uploadHandler)="subirNota($event)" [disabled]="adjuntando()" />

      <p class="texto-modal tenue">PDF o imagen, hasta 5 MB.</p>
    </p-dialog>
  `,
  styles: [`
    .titulo { display:flex; align-items:center; gap:.625rem; }
    .titulo h1 { margin:0; }

    .estado { display:inline-block; padding:.0625rem .4375rem; border-radius:2px;
              font-size:var(--t-xs); border:1px solid var(--linea);
              color:var(--tinta-suave); }
    .estado-registrada { border-color:var(--bien); color:var(--bien); }
    .estado-anulada { border-color:var(--alerta); color:var(--alerta); }

    .aviso { display:flex; align-items:center; gap:.5rem; margin:0 0 1rem;
             padding:.625rem .75rem; border-left:2px solid var(--aviso);
             background:var(--fondo-suave); font-size:var(--t-sm); }
    .aviso.alerta { border-left-color:var(--alerta); }

    .tarjeta { border:1px solid var(--linea); border-radius:3px;
               padding:1rem 1.125rem; margin-bottom:1rem; }
    .tarjeta h2 { font-size:var(--t-sm); font-weight:600; margin:0 0 .875rem;
                  color:var(--tinta-suave); text-transform:uppercase;
                  letter-spacing:.04em; }

    .datos { display:flex; gap:2.5rem; flex-wrap:wrap; }
    .datos > div { display:flex; flex-direction:column; gap:.125rem; }
    .datos .destacado { margin-left:auto; text-align:right; }
    .datos .destacado .importe { font-size:var(--t-lg); }

    .rotulo { font-size:var(--t-xs); color:var(--tinta-suave); }
    .unidad-medida { font-size:var(--t-xs); color:var(--tinta-tenue); }
    .observaciones { margin:.875rem 0 0; padding-top:.875rem;
                     border-top:1px solid var(--linea); font-size:var(--t-sm); }

    .importe { font-variant-numeric:tabular-nums; }
    .tenue { color:var(--tinta-suave); }
    .persona { font-size:var(--t-xs); color:var(--tinta-suave); }
    .enlace { color:inherit; text-decoration:none; border-bottom:1px dotted var(--linea); }
    .enlace:hover { border-bottom-color:var(--tinta-suave); }

    .marca-danado { font-size:var(--t-xs); padding:.0625rem .375rem; border-radius:2px;
                    border:1px solid var(--aviso); color:var(--aviso); }

    tr.expansion > td { background:var(--fondo-suave); padding:0; }
    .capas { padding:.875rem 1.125rem .875rem 4rem; }
    .capas h3 { font-size:var(--t-xs); font-weight:600; margin:0 0 .5rem;
                color:var(--tinta-suave); text-transform:uppercase; letter-spacing:.04em; }

    .tabla-capas { width:100%; max-width:34rem; border-collapse:collapse;
                   font-size:var(--t-sm); }
    .tabla-capas th { text-align:left; font-weight:500; color:var(--tinta-suave);
                      font-size:var(--t-xs); padding:.1875rem .5rem; }
    .tabla-capas td { padding:.1875rem .5rem; border-top:1px solid var(--linea); }

    .total-pie { display:flex; justify-content:flex-end; align-items:baseline; gap:.75rem;
                 margin-top:.875rem; padding-top:.875rem; border-top:1px solid var(--linea); }
    .total-pie .importe { font-size:var(--t-lg); }

    .texto-modal { font-size:var(--t-sm); margin:0 0 .875rem; }
  `],
})
export class DevolucionDetalleComponent implements OnInit {
  private readonly servicio = inject(DevolucionService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);
  private readonly confirmacion = inject(ConfirmationService);

  readonly devolucion = signal<(Devolucion & { detalles?: DevolucionDetalle[] }) | null>(null);
  readonly subiendo = signal(false);
  readonly adjuntando = signal(false);

  expandidas: Record<string, boolean> = {};

  readonly detalles = computed(() => this.devolucion()?.detalles ?? []);

  /** Para el modal de PrimeNG, que necesita una propiedad con setter. */
  get subiendoModal(): boolean {
    return this.subiendo();
  }

  set subiendoModal(valor: boolean) {
    this.subiendo.set(valor);
  }

  ngOnInit(): void {
    const id = Number(this.ruta.snapshot.paramMap.get('id'));

    this.cargar(id);
  }

  etiquetaMotivo(valor: string): string {
    return MOTIVOS_DEVOLUCION.find(m => m.valor === valor)?.etiqueta ?? valor;
  }

  /** El costo unitario no se guarda en la línea: sale del total sobre la cantidad. */
  costoUnitario(linea: DevolucionDetalle): number {
    return linea.cantidad > 0 ? linea.costo_total / linea.cantidad : 0;
  }

  confirmarAnulacion(): void {
    let motivo = '';

    this.confirmacion.confirm({
      header: 'Anular la devolución',
      message: 'El material devuelto se volverá a descontar de las existencias. '
             + 'Si ya salió de nuevo, la anulación no va a ser posible. '
             + 'Explique el motivo:',
      acceptLabel: 'Anular',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        motivo = window.prompt('Motivo de la anulación (mínimo 10 caracteres):') ?? '';

        if (motivo.trim().length < 10) {
          this.mensajes.add({
            severity: 'warn',
            summary: 'Falta el motivo',
            detail: 'La anulación queda en la bitácora: explique por qué se anula.',
          });

          return;
        }

        this.anular(motivo.trim());
      },
    });
  }

  private anular(motivo: string): void {
    const d = this.devolucion();

    if (!d) {
      return;
    }

    this.servicio.anular(d.id, motivo).subscribe({
      next: res => {
        this.mensajes.add({ severity: 'success', summary: 'Anulada', detail: res.mensaje });
        this.cargar(d.id);
      },
      error: err => {
        // El backend rechaza si el material devuelto ya volvió a salir.
        this.mensajes.add({
          severity: 'error',
          summary: 'No se pudo anular',
          detail: err?.error?.mensaje ?? 'Intente de nuevo.',
          life: 8000,
        });
      },
    });
  }

  subirNota(evento: { files: File[] }): void {
    const d = this.devolucion();
    const archivo = evento.files?.[0];

    if (!d || !archivo) {
      return;
    }

    this.adjuntando.set(true);

    this.servicio.subirNota(d.id, archivo).subscribe({
      next: () => {
        this.mensajes.add({
          severity: 'success',
          summary: 'Nota adjuntada',
          detail: 'La devolución queda con su respaldo firmado.',
        });

        this.adjuntando.set(false);
        this.subiendo.set(false);
        this.cargar(d.id);
      },
      error: err => {
        this.adjuntando.set(false);

        this.mensajes.add({
          severity: 'error',
          summary: 'No se pudo adjuntar',
          detail: err?.error?.mensaje ?? 'Revise el archivo e intente de nuevo.',
        });
      },
    });
  }

  imprimir(): void {
    const d = this.devolucion();

    if (!d) {
      return;
    }

    // responseType blob en el servicio: sin eso el PDF llega corrupto.
    this.servicio.pdf(d.id).subscribe(blob => {
      const url = URL.createObjectURL(blob);

      window.open(url, '_blank');

      // No se revoca de inmediato: la pestaña nueva todavía lo está leyendo.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }

  private cargar(id: number): void {
    this.servicio.ver(id).subscribe({
      next: d => this.devolucion.set(d),
      error: () => this.router.navigate(['/devoluciones']),
    });
  }
}
