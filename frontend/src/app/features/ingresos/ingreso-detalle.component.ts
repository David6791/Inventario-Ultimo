import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { Ingreso } from '../../core/models/ingreso.models';
import { IngresoService } from '../../core/services/ingreso.service';
import { PermisosService } from '../../core/services/permisos.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-ingreso-detalle',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, DecimalPipe, TitleCasePipe, TableModule,
    ButtonModule, DialogModule, InputTextareaModule, TooltipModule,
    TienePermisoDirective,
  ],
  template: `
    @if (ingreso(); as g) {
      <header class="pagina">
        <div>
          <h1><span class="codigo">{{ g.numero }}</span></h1>
          <p>{{ g.proveedor }} · Solicitud {{ g.solicitud_numero }} ·
             {{ g.fecha | date:'dd/MM/yyyy' }}</p>
        </div>
        <div class="acciones">
          <button pButton label="Volver" severity="secondary" text
                  routerLink="/ingresos"></button>

          <button pButton icon="pi pi-print" label="Imprimir acta" outlined
                  [loading]="imprimiendo()" (click)="imprimir()"></button>

          @if (g.editable) {
            <button pButton icon="pi pi-pencil" label="Editar" outlined
                    [routerLink]="['/ingresos', g.id, 'editar']"
                    *appTienePermiso="'ingresos.editar'"></button>
            <button pButton icon="pi pi-check-circle" label="Confirmar recepción"
                    *appTienePermiso="'ingresos.confirmar'"
                    [loading]="procesando()" (click)="confirmar()"></button>
          }

          @if (g.estado === 'confirmada') {
            <button pButton icon="pi pi-ban" label="Anular" severity="danger" outlined
                    *appTienePermiso="'ingresos.anular'"
                    (click)="dialogoAnular = true"></button>
          }
        </div>
      </header>

      @if (g.estado === 'borrador') {
        <div class="aviso" role="status">
          <i class="pi pi-info-circle"></i>
          <span>
            Este borrador <strong>todavía no ingresó el material</strong>. Al
            confirmarlo sube el stock, se registra el costo y se descuenta el
            saldo de la solicitud.
          </span>
        </div>
      }

      @if (g.estado === 'confirmada' && !g.tiene_respaldo) {
        <div class="aviso pendiente" role="status">
          <i class="pi pi-exclamation-circle"></i>
          <span>Falta adjuntar la factura o nota de entrega del proveedor.</span>
          <button pButton icon="pi pi-upload" label="Adjuntar documento" size="small"
                  *appTienePermiso="'ingresos.confirmar'"
                  (click)="abrirSubida()"></button>
        </div>
      }

      @if (g.estado === 'anulada') {
        <div class="aviso anulado" role="status">
          <i class="pi pi-times-circle"></i>
          <span>
            Anulado el {{ g.anulada_en | date:'dd/MM/yyyy' }}. El material fue
            retirado del stock. Motivo: {{ g.motivo_anulacion }}
          </span>
        </div>
      }

      <div class="ficha">
        <div><span class="rotulo">Estado</span>
             <span class="estado" [class]="'estado-' + g.estado">{{ g.estado_etiqueta }}</span></div>
        <div><span class="rotulo">Almacén</span>{{ g.almacen }}</div>
        <div><span class="rotulo">Documento</span>
             {{ g.tipo_documento === 'nota-entrega' ? 'Nota de entrega' : (g.tipo_documento | titlecase) }}
             {{ g.numero_documento || '' }}</div>
        @if (g.fecha_documento) {
          <div><span class="rotulo">Fecha del documento</span>
               {{ g.fecha_documento | date:'dd/MM/yyyy' }}</div>
        }
        <div><span class="rotulo">Registró</span>{{ g.registrado_por }}</div>
        @if (g.confirmada_en) {
          <div><span class="rotulo">Confirmó</span>
               {{ g.confirmada_por }} — {{ g.confirmada_en | date:'dd/MM/yyyy HH:mm' }}</div>
        }
      </div>

      @if (g.observaciones) {
        <p class="observaciones"><span class="rotulo">Observaciones</span>{{ g.observaciones }}</p>
      }

      @if (g.tiene_respaldo) {
        <div class="adjunto">
          <i class="pi pi-file-pdf"></i>
          <span>{{ g.respaldo_nombre }}</span>
          <button pButton icon="pi pi-download" label="Descargar" text size="small"
                  (click)="descargarRespaldo()"></button>
        </div>
      }

      <p-table [value]="g.detalles ?? []" dataKey="id" styleClass="p-datatable-sm">
        <ng-template pTemplate="header">
          <tr>
            <th style="width:8rem">Código</th>
            <th>Producto</th>
            <th style="width:4.5rem">Unidad</th>
            <th style="width:8rem" class="cifra">Cantidad</th>
            <th style="width:9rem" class="cifra">P. unitario</th>
            <th style="width:9rem" class="cifra">Importe</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-d>
          <tr>
            <td><span class="codigo">{{ d.codigo }}</span></td>
            <td>
              {{ d.producto }}
              @if (d.lote || d.fecha_vencimiento) {
                <div class="trazabilidad">
                  @if (d.lote) { <span>Lote {{ d.lote }}</span> }
                  @if (d.fecha_vencimiento) {
                    <span>Vence {{ d.fecha_vencimiento | date:'dd/MM/yyyy' }}</span>
                  }
                </div>
              }
            </td>
            <td><span class="codigo">{{ d.unidad }}</span></td>
            <td class="cifra">{{ d.cantidad | number:'1.0-4' }}</td>
            <td class="cifra tenue">{{ d.costo_unitario | number:'1.2-2' }}</td>
            <td class="cifra">{{ d.importe | number:'1.2-2' }}</td>
          </tr>
        </ng-template>

        <ng-template pTemplate="footer">
          <tr>
            <td colspan="5" class="cifra total-rotulo">Total en bolivianos</td>
            <td class="cifra total">{{ g.valor_total | number:'1.2-2' }}</td>
          </tr>
        </ng-template>
      </p-table>

      <!-- --------------------------------------------- Adjuntar factura -->
      <p-dialog header="Adjuntar documento del proveedor" [(visible)]="dialogoRespaldo"
                [modal]="true" [draggable]="false" [style]="{ width: '32rem' }">
        <p class="nota">
          Escanee la factura o nota de entrega de <strong>{{ g.proveedor }}</strong>
          y adjúntela acá. Queda archivada como respaldo del ingreso.
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

        @if (errorRespaldo()) { <small class="error-subida">{{ errorRespaldo() }}</small> }

        <div class="pie">
          <button pButton label="Cancelar" severity="secondary" text
                  (click)="cerrarSubida()"></button>
          <button pButton label="Adjuntar" icon="pi pi-check" [disabled]="!archivo"
                  [loading]="subiendo()" (click)="subirRespaldo()"></button>
        </div>
      </p-dialog>

      <!-- ------------------------------------------------------ Anular -->
      <p-dialog header="Anular ingreso" [(visible)]="dialogoAnular" [modal]="true"
                [draggable]="false" [style]="{ width: '30rem' }">
        <p class="nota">
          El material se retirará del stock y el saldo volverá a quedar pendiente
          en la solicitud. Si parte de este ingreso ya salió del almacén, el
          sistema no lo permitirá: hay que anular primero esas salidas.
        </p>

        <div class="campo">
          <label>Motivo</label>
          <textarea pInputTextarea [(ngModel)]="motivo" rows="3"
                    placeholder="Por qué se anula"></textarea>
        </div>

        <div class="pie">
          <button pButton label="Cancelar" severity="secondary" text
                  (click)="dialogoAnular = false"></button>
          <button pButton label="Anular ingreso" severity="danger"
                  [loading]="procesando()" (click)="anular()"></button>
        </div>
      </p-dialog>
    }
  `,
  styles: [`
    .pagina h1 { font-size:var(--t-md); }

    .aviso { display:flex; align-items:center; gap:.625rem; padding:.75rem .875rem;
             margin-bottom:1rem; border:1px solid var(--linea);
             border-left:3px solid var(--acento); border-radius:var(--radio);
             background:var(--acento-lavado); font-size:var(--t-sm); line-height:1.5; }
    .aviso i { color:var(--acento); }
    .aviso span { flex:1; }
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

    .observaciones { display:flex; flex-direction:column; gap:.125rem;
                     font-size:var(--t-sm); max-width:70ch; margin:0 0 1.25rem; }

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

    .trazabilidad { display:flex; gap:.75rem; font-size:var(--t-xs);
                    color:var(--tinta-suave); margin-top:.125rem; }
    .tenue { color:var(--tinta-suave); }
    .total-rotulo { color:var(--tinta-suave); font-size:var(--t-sm); }
    .total { font-weight:600; }

    .nota { font-size:var(--t-sm); color:var(--tinta-suave); margin:0 0 1rem;
            line-height:1.5; }
    .campo textarea { width:100%; }

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
                            overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .zona-archivo .peso { font-size:var(--t-xs); color:var(--tinta-suave); }
    .zona-archivo input[type="file"] { position:absolute; inset:0; opacity:0;
                                       cursor:pointer; }
    .error-subida { display:block; margin-top:.5rem; font-size:var(--t-xs);
                    color:var(--alerta); }

    .pie { display:flex; justify-content:flex-end; gap:.5rem; margin-top:1.25rem;
           padding-top:1rem; border-top:1px solid var(--linea-tenue); }
  `],
})
export class IngresoDetalleComponent implements OnInit {
  private readonly servicio = inject(IngresoService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);
  private readonly confirmacion = inject(ConfirmationService);
  readonly permisos = inject(PermisosService);

  readonly id = input.required<string>();

  readonly ingreso = signal<Ingreso | null>(null);
  readonly procesando = signal(false);
  readonly imprimiendo = signal(false);
  readonly subiendo = signal(false);
  readonly errorRespaldo = signal<string | null>(null);

  dialogoAnular = false;
  dialogoRespaldo = false;
  motivo = '';
  archivo: File | null = null;

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.servicio.obtener(Number(this.id()))
      .subscribe(res => this.ingreso.set(res.data));
  }

  confirmar(): void {
    const g = this.ingreso();
    if (!g) return;

    this.confirmacion.confirm({
      header: 'Confirmar la recepción',
      message: `Entrarán ${g.detalles?.length ?? 0} producto(s) al almacén por `
             + `Bs ${(g.valor_total ?? 0).toFixed(2)}. Se registrará el costo y `
             + 'se descontará el saldo de la solicitud.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Confirmar recepción',
      rejectLabel: 'Todavía no',
      accept: () => {
        this.procesando.set(true);

        this.servicio.confirmar(Number(this.id())).subscribe({
          next: res => {
            this.ingreso.set(res.data);
            this.procesando.set(false);
            this.mensajes.add({
              severity: 'success',
              summary: 'Recepción confirmada',
              detail: 'El material ya está disponible. Ahora adjunte el documento del proveedor.',
            });
          },
          error: (error: HttpErrorResponse) => {
            this.procesando.set(false);
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
        detail: 'Escriba por qué se anula el ingreso.',
      });
      return;
    }

    this.procesando.set(true);

    this.servicio.anular(Number(this.id()), this.motivo).subscribe({
      next: res => {
        this.ingreso.set(res.data);
        this.dialogoAnular = false;
        this.procesando.set(false);
        this.mensajes.add({ severity: 'success', summary: 'Ingreso anulado' });
      },
      error: (error: HttpErrorResponse) => {
        this.procesando.set(false);
        // Falla si el material ya salió: revertir la capa descuadraría el costeo.
        if (error.status === 409) {
          this.mensajes.add({
            severity: 'error',
            summary: 'No se pudo anular',
            detail: error.error?.message,
            life: 12_000,
          });
        }
      },
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
        this.ingreso.set(res.data);
        this.subiendo.set(false);
        this.cerrarSubida();
        this.mensajes.add({ severity: 'success', summary: 'Documento adjunto' });
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

    this.servicio.descargarActa(Number(this.id())).subscribe({
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
      enlace.download = this.ingreso()?.respaldo_nombre ?? 'documento.pdf';
      enlace.click();
      URL.revokeObjectURL(url);
    });
  }
}
