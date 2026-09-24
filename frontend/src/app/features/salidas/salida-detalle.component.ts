import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { Salida } from '../../core/models/salida.models';
import { PermisosService } from '../../core/services/permisos.service';
import { SalidaService } from '../../core/services/salida.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-salida-detalle',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, DecimalPipe, TableModule, ButtonModule,
    DialogModule, InputTextareaModule, TooltipModule, TienePermisoDirective,
  ],
  template: `
    @if (salida(); as s) {
      <header class="pagina">
        <div>
          <h1><span class="codigo">{{ s.numero }}</span></h1>
          <p>{{ s.unidad_solicitante }} · Recibió {{ s.recibido_por }} ·
             {{ s.fecha | date:'dd/MM/yyyy' }}</p>
        </div>
        <div class="acciones">
          <button pButton label="Volver" severity="secondary" text
                  routerLink="/salidas"></button>

          <button pButton icon="pi pi-print" label="Imprimir nota" outlined
                  [loading]="imprimiendo()" (click)="imprimir()"></button>

          @if (s.editable) {
            <button pButton icon="pi pi-pencil" label="Editar" outlined
                    [routerLink]="['/salidas', s.id, 'editar']"
                    *appTienePermiso="'salidas.editar'"></button>
            <button pButton icon="pi pi-check-circle" label="Confirmar entrega"
                    *appTienePermiso="'salidas.confirmar'"
                    [loading]="procesando()" (click)="confirmar()"></button>
          }

          @if (s.estado === 'confirmada') {
            <button pButton icon="pi pi-ban" label="Anular" severity="danger" outlined
                    *appTienePermiso="'salidas.anular'"
                    (click)="dialogoAnular = true"></button>
          }
        </div>
      </header>

      @if (s.estado === 'borrador') {
        <div class="aviso" role="status">
          <i class="pi pi-info-circle"></i>
          <span>
            Este borrador <strong>no descontó existencias todavía</strong>.
            Imprima la nota, hágala firmar por quien retira y use
            <strong>Confirmar entrega</strong>.
          </span>
        </div>
      }

      @if (s.estado === 'confirmada' && !s.tiene_respaldo) {
        <div class="aviso pendiente" role="status">
          <i class="pi pi-exclamation-circle"></i>
          <span>
            Falta subir la nota firmada. El material ya salió; sin el escaneo, la
            entrega queda sin respaldo documental.
          </span>
          <button pButton icon="pi pi-upload" label="Subir nota firmada" size="small"
                  *appTienePermiso="'salidas.confirmar'"
                  (click)="abrirSubida()"></button>
        </div>
      }

      @if (s.estado === 'anulada') {
        <div class="aviso anulado" role="status">
          <i class="pi pi-times-circle"></i>
          <span>
            Anulada el {{ s.anulada_en | date:'dd/MM/yyyy' }}. Las existencias
            fueron devueltas. Motivo: {{ s.motivo_anulacion }}
          </span>
        </div>
      }

      <div class="ficha">
        <div><span class="rotulo">Estado</span>
             <span class="estado" [class]="'estado-' + s.estado">{{ s.estado_etiqueta }}</span></div>
        <div><span class="rotulo">Solicitante</span>{{ s.solicitante }}</div>
        <div><span class="rotulo">Almacén</span>{{ s.almacen }}</div>
        <div><span class="rotulo">Registró</span>{{ s.registrado_por }}</div>

        @if (s.centro_costo) {
          <div><span class="rotulo">Centro de costo</span>
               <span class="codigo">{{ s.centro_costo }}</span></div>
        }
        @if (s.destino) {
          <div><span class="rotulo">Destino</span>{{ s.destino }}</div>
        }
        @if (s.confirmada_en) {
          <div><span class="rotulo">Confirmó</span>
               {{ s.confirmada_por }} — {{ s.confirmada_en | date:'dd/MM/yyyy HH:mm' }}</div>
        }
      </div>

      @if (s.motivo) {
        <p class="motivo"><span class="rotulo">Motivo</span>{{ s.motivo }}</p>
      }

      @if (s.tiene_respaldo) {
        <div class="adjunto">
          <i class="pi pi-file-pdf"></i>
          <span>{{ s.respaldo_nombre }}</span>
          <button pButton icon="pi pi-download" label="Descargar" text size="small"
                  (click)="descargarRespaldo()"></button>
        </div>
      }

      <p-table [value]="s.detalles ?? []" dataKey="id" styleClass="p-datatable-sm">
        <ng-template pTemplate="header">
          <tr>
            <th style="width:9rem">Código</th>
            <th>Producto</th>
            <th style="width:4.5rem">Unidad</th>
            <th style="width:8rem" class="cifra">Cantidad</th>
            @if (s.estado === 'confirmada' && permisos.can('stock.ver-costos')) {
              <th style="width:8rem" class="cifra">Costo unit.</th>
              <th style="width:8rem" class="cifra">Total</th>
            }
            <th>Observación</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-d>
          <tr>
            <td><span class="codigo">{{ d.codigo }}</span></td>
            <td>{{ d.producto }}</td>
            <td><span class="codigo">{{ d.unidad }}</span></td>
            <td class="cifra">{{ d.cantidad | number:'1.0-4' }}</td>
            @if (s.estado === 'confirmada' && permisos.can('stock.ver-costos')) {
              <td class="cifra tenue">{{ d.costo_unitario | number:'1.2-2' }}</td>
              <td class="cifra">{{ d.cantidad * d.costo_unitario | number:'1.2-2' }}</td>
            }
            <td class="tenue">{{ d.observacion || '—' }}</td>
          </tr>
        </ng-template>
      </p-table>

      <p-dialog header="Adjuntar la nota firmada" [(visible)]="dialogoRespaldo"
                [modal]="true" [draggable]="false" [style]="{ width: '32rem' }">
        <p class="nota">
          Escanee la nota que firmó <strong>{{ s.recibido_por }}</strong> y
          adjúntela acá. Queda archivada como respaldo de la entrega.
        </p>

        <div class="zona-archivo" [class.con-archivo]="archivo">
          @if (archivo) {
            <i class="pi pi-file-pdf"></i>
            <div class="datos">
              <span class="nombre">{{ archivo.name }}</span>
              <span class="peso">{{ (archivo.size / 1024 / 1024).toFixed(2) }} MB</span>
            </div>
            <button pButton icon="pi pi-times" text rounded severity="danger"
                    pTooltip="Quitar" (click)="archivo = null"></button>
          } @else {
            <i class="pi pi-cloud-upload"></i>
            <div class="datos">
              <span class="nombre">Elija el archivo escaneado</span>
              <span class="peso">Solo PDF, hasta 10 MB</span>
            </div>
            <input type="file" accept="application/pdf" (change)="elegirArchivo($event)" />
          }
        </div>

        @if (errorRespaldo()) {
          <small class="error-subida">{{ errorRespaldo() }}</small>
        }

        <div class="pie">
          <button pButton label="Cancelar" severity="secondary" text
                  (click)="cerrarSubida()"></button>
          <button pButton label="Adjuntar" icon="pi pi-check" [disabled]="!archivo"
                  [loading]="subiendo()" (click)="subirRespaldo()"></button>
        </div>
      </p-dialog>

      <p-dialog header="Anular salida" [(visible)]="dialogoAnular" [modal]="true"
                [draggable]="false" [style]="{ width: '30rem' }">
        <p class="nota">Las existencias se devolverán al almacén. El movimiento
           original no se borra: se registra uno inverso en el kardex, así queda
           el rastro de la anulación.</p>

        <div class="campo">
          <label>Motivo</label>
          <textarea pInputTextarea [(ngModel)]="motivo" rows="3"
                    placeholder="Por qué se anula"></textarea>
        </div>

        <div class="pie">
          <button pButton label="Cancelar" severity="secondary" text
                  (click)="dialogoAnular = false"></button>
          <button pButton label="Anular salida" severity="danger"
                  [loading]="procesando()" (click)="anular()"></button>
        </div>
      </p-dialog>
    }
  `,
  styles: [`
    .pagina h1 { font-size:var(--t-md); }

    .aviso { display:flex; align-items:center; gap:.625rem;
             padding:.75rem .875rem; margin-bottom:1rem;
             border:1px solid var(--linea); border-left:3px solid var(--acento);
             border-radius:var(--radio); background:var(--acento-lavado);
             font-size:var(--t-sm); line-height:1.5; }
    .aviso i { color:var(--acento); }
    .aviso span { flex:1; }
    .aviso.pendiente { border-left-color:var(--aviso); background:var(--aviso-lavado); }
    .aviso.pendiente i { color:var(--aviso); }
    .aviso.anulado { border-left-color:var(--alerta); background:var(--alerta-lavado); }
    .aviso.anulado i { color:var(--alerta); }
    /* Zona de archivo: estado vacío y estado con archivo elegido, sin cambiar
       de altura para que el modal no salte al seleccionar. */
    .zona-archivo { position:relative; display:flex; align-items:center; gap:.875rem;
                    padding:1rem; border:1px dashed var(--linea);
                    border-radius:var(--radio); background:var(--papel); }
    .zona-archivo.con-archivo { border-style:solid; border-color:var(--acento);
                                background:var(--acento-lavado); }
    .zona-archivo > i { font-size:1.5rem; color:var(--tinta-tenue); }
    .zona-archivo.con-archivo > i { color:var(--alerta); }
    .zona-archivo .datos { flex:1; display:flex; flex-direction:column; gap:.125rem;
                           min-width:0; }
    .zona-archivo .nombre { font-size:var(--t-sm); font-weight:500;
                            overflow:hidden; text-overflow:ellipsis;
                            white-space:nowrap; }
    .zona-archivo .peso { font-size:var(--t-xs); color:var(--tinta-suave); }
    /* El input cubre la zona: toda el área es clicable, no solo el botón. */
    .zona-archivo input[type="file"] { position:absolute; inset:0; opacity:0;
                                       cursor:pointer; }

    .error-subida { display:block; margin-top:.5rem; font-size:var(--t-xs);
                    color:var(--alerta); }

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
    .estado-confirmada { border-color:var(--bien); color:var(--bien); }
    .estado-anulada { border-color:var(--alerta); color:var(--alerta); }

    .adjunto { display:flex; align-items:center; gap:.625rem; padding:.625rem .875rem;
               border:1px solid var(--linea); border-radius:var(--radio);
               margin-bottom:1.25rem; font-size:var(--t-sm); max-width:30rem; }
    .adjunto i { color:var(--alerta); }
    .adjunto span { flex:1; }

    .tenue { color:var(--tinta-suave); }
    .nota { font-size:var(--t-sm); color:var(--tinta-suave); margin:0 0 1rem;
            line-height:1.5; }
    .campo textarea { width:100%; }
    .pie { display:flex; justify-content:flex-end; gap:.5rem; margin-top:1.25rem;
           padding-top:1rem; border-top:1px solid var(--linea-tenue); }
  `],
})
export class SalidaDetalleComponent implements OnInit {
  private readonly servicio = inject(SalidaService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);
  private readonly confirmar_ = inject(ConfirmationService);
  readonly permisos = inject(PermisosService);

  readonly id = input.required<string>();

  readonly salida = signal<Salida | null>(null);
  readonly procesando = signal(false);
  readonly imprimiendo = signal(false);

  dialogoAnular = false;
  dialogoRespaldo = false;
  motivo = '';
  archivo: File | null = null;

  readonly subiendo = signal(false);
  readonly errorRespaldo = signal<string | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.servicio.obtener(Number(this.id()))
      .subscribe(res => this.salida.set(res.data));
  }

  /** El momento en que el material sale del almacén. */
  confirmar(): void {
    const s = this.salida();
    if (!s) return;

    this.confirmar_.confirm({
      header: 'Confirmar la entrega',
      message: `Se descontarán las existencias de ${s.detalles?.length ?? 0} `
             + 'producto(s) y quedará registrado en el kardex. '
             + 'Hágalo cuando el material ya haya sido entregado y firmado.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Confirmar entrega',
      rejectLabel: 'Todavía no',
      accept: () => {
        this.procesando.set(true);

        this.servicio.confirmar(Number(this.id())).subscribe({
          next: res => {
            this.salida.set(res.data);
            this.procesando.set(false);
            this.mensajes.add({
              severity: 'success',
              summary: 'Entrega confirmada',
              detail: 'Existencias descontadas. Ahora suba la nota firmada.',
            });
          },
          error: (error: HttpErrorResponse) => {
            this.procesando.set(false);
            // Puede fallar si el saldo cambió entre el borrador y este momento.
            if (error.status === 409) {
              this.mensajes.add({
                severity: 'error',
                summary: 'No se pudo confirmar',
                detail: error.error?.message,
                life: 10_000,
              });
            }
          },
        });
      },
    });
  }

  anular(): void {
    if (!this.motivo.trim()) {
      this.mensajes.add({
        severity: 'warn',
        summary: 'Falta el motivo',
        detail: 'Escriba por qué se anula la salida.',
      });
      return;
    }

    this.procesando.set(true);

    this.servicio.anular(Number(this.id()), this.motivo).subscribe({
      next: res => {
        this.salida.set(res.data);
        this.dialogoAnular = false;
        this.procesando.set(false);
        this.mensajes.add({
          severity: 'success',
          summary: 'Salida anulada',
          detail: 'Las existencias fueron devueltas.',
        });
      },
      error: () => this.procesando.set(false),
    });
  }

  abrirSubida(): void {
    this.archivo = null;
    this.errorRespaldo.set(null);
    this.dialogoRespaldo = true;
  }

  cerrarSubida(): void {
    this.dialogoRespaldo = false;
    this.archivo = null;
    this.errorRespaldo.set(null);
  }

  /**
   * Se valida el tamaño acá además de en el servidor: subir 30 MB por una red
   * lenta para que el backend lo rechace al final es tiempo perdido.
   */
  elegirArchivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0] ?? null;
    entrada.value = '';

    this.errorRespaldo.set(null);

    if (!archivo) return;

    if (archivo.type !== 'application/pdf') {
      this.errorRespaldo.set('El archivo debe ser un PDF.');
      return;
    }

    if (archivo.size > 10 * 1024 * 1024) {
      this.errorRespaldo.set('El archivo supera los 10 MB. Escanee en menor resolución.');
      return;
    }

    this.archivo = archivo;
  }

  subirRespaldo(): void {
    if (!this.archivo) return;

    this.subiendo.set(true);
    this.errorRespaldo.set(null);

    this.servicio.subirRespaldo(Number(this.id()), this.archivo).subscribe({
      next: res => {
        this.salida.set(res.data);
        this.subiendo.set(false);
        this.cerrarSubida();
        this.mensajes.add({
          severity: 'success',
          summary: 'Respaldo adjunto',
          detail: 'La entrega queda documentada.',
        });
      },
      error: (error: HttpErrorResponse) => {
        this.subiendo.set(false);
        this.errorRespaldo.set(
          error.error?.errors?.respaldo?.[0]
          ?? error.error?.message
          ?? 'No se pudo subir el archivo. Intente nuevamente.',
        );
      },
    });
  }

  imprimir(): void {
    this.imprimiendo.set(true);

    this.servicio.descargarNota(Number(this.id())).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        this.imprimiendo.set(false);
      },
      error: () => this.imprimiendo.set(false),
    });
  }

  descargarRespaldo(): void {
    this.servicio.descargarRespaldo(Number(this.id())).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = this.salida()?.respaldo_nombre ?? 'nota-firmada.pdf';
      enlace.click();
      URL.revokeObjectURL(url);
    });
  }
}
