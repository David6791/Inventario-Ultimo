import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { SolicitudCompra } from '../../core/models/solicitud.models';
import { SolicitudService } from '../../core/services/solicitud.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-solicitud-detalle',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DatePipe, DecimalPipe, TableModule, ButtonModule,
    DialogModule, CalendarModule, InputTextModule, InputTextareaModule,
    FileUploadModule, TooltipModule, TienePermisoDirective,
  ],
  template: `
    @if (solicitud(); as s) {
      <header class="pagina">
        <div>
          <h1><span class="codigo">{{ s.numero }}</span></h1>
          <p>{{ s.tipo_etiqueta }} · {{ s.unidad_solicitante }} ·
             {{ s.fecha | date:'dd/MM/yyyy' }}</p>
        </div>
        <div class="acciones">
          <button pButton label="Volver" severity="secondary" text
                  [routerLink]="['/solicitudes']"></button>

          <button pButton icon="pi pi-print" label="Imprimir formulario" outlined
                  [loading]="imprimiendo()" (click)="imprimir()"></button>

          @if (s.editable) {
            <button pButton icon="pi pi-pencil" label="Editar" outlined
                    [routerLink]="['/solicitudes', s.id, 'editar']"
                    *appTienePermiso="'solicitudes.editar'"></button>
            <button pButton icon="pi pi-check-square" label="Registrar aprobación"
                    *appTienePermiso="'solicitudes.aprobar'"
                    (click)="dialogoAprobar = true"></button>
          }

          @if (!s.editable && s.estado !== 'anulada' && s.estado !== 'rechazada') {
            <button pButton icon="pi pi-ban" label="Anular" severity="danger" outlined
                    *appTienePermiso="'solicitudes.anular'"
                    (click)="dialogoAnular = true"></button>
          }
        </div>
      </header>

      @if (s.estado === 'borrador') {
        <div class="circuito">
          <i class="pi pi-info-circle"></i>
          <span>
            Imprima el formulario, hágalo firmar y escanéelo. Después use
            <strong>Registrar aprobación</strong> para adjuntar el PDF firmado.
          </span>
        </div>
      }

      <div class="ficha">
        <div><span class="rotulo">Estado</span>
             <span class="estado" [class]="'estado-' + s.estado">{{ s.estado_etiqueta }}</span></div>
        <div><span class="rotulo">Solicitante</span>{{ s.solicitante }}</div>
        <div><span class="rotulo">Almacén</span>{{ s.almacen }}</div>
        <div><span class="rotulo">Registró</span>{{ s.registrado_por }}</div>

        @if (s.partida_presupuestaria) {
          <div><span class="rotulo">Partida</span>
               <span class="codigo">{{ s.partida_presupuestaria }}</span></div>
        }
        @if (s.monto_estimado) {
          <div><span class="rotulo">Monto estimado</span>
               Bs {{ s.monto_estimado | number:'1.2-2' }}</div>
        }
        @if (s.fecha_aprobacion) {
          <div><span class="rotulo">Aprobación</span>
               {{ s.fecha_aprobacion | date:'dd/MM/yyyy' }} — {{ s.aprobado_por }}</div>
        }
      </div>

      @if (s.justificacion) {
        <p class="justificacion"><span class="rotulo">Justificación</span>{{ s.justificacion }}</p>
      }

      @if (s.documento_nombre) {
        <div class="adjunto">
          <i class="pi pi-file-pdf"></i>
          <span>{{ s.documento_nombre }}</span>
          <button pButton icon="pi pi-download" label="Descargar" text size="small"
                  (click)="descargar()"></button>
        </div>
      }

      <p-table [value]="s.detalles ?? []" dataKey="id" styleClass="p-datatable-sm tabla">
        <ng-template pTemplate="header">
          <tr>
            <th style="width:9rem">Código</th>
            <th>Producto</th>
            <th style="width:4.5rem">Unidad</th>
            <th style="width:7rem" class="cifra">Pedido</th>
            <th style="width:7rem" class="cifra">Atendido</th>
            <th style="width:7rem" class="cifra">Saldo</th>
            <th>Especificación</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-d>
          <tr class="marca" [class.marca-bajo]="d.saldo > 0 && d.cantidad_atendida > 0">
            <td><span class="codigo">{{ d.codigo }}</span></td>
            <td>{{ d.producto }}</td>
            <td><span class="codigo">{{ d.unidad }}</span></td>
            <td class="cifra">{{ d.cantidad | number:'1.0-4' }}</td>
            <td class="cifra">{{ d.cantidad_atendida | number:'1.0-4' }}</td>
            <td class="cifra" [class.pendiente]="d.saldo > 0">{{ d.saldo | number:'1.0-4' }}</td>
            <td class="tenue">{{ d.especificacion || '—' }}</td>
          </tr>
        </ng-template>
      </p-table>

      <!-- ------------------------------------------------- Aprobación -->
      <p-dialog header="Registrar aprobación" [(visible)]="dialogoAprobar" [modal]="true"
                [draggable]="false" [style]="{ width: '32rem' }">
        <p class="nota">La aprobación se firma en papel. Acá se deja constancia
           del resultado y se adjunta el escaneo.</p>

        <div class="campo">
          <label>Fecha de la aprobación</label>
          <p-calendar [(ngModel)]="fechaAprobacion" dateFormat="dd/mm/yy"
                      [maxDate]="hoy" [showIcon]="true" styleClass="ancho"
                      appendTo="body" />
        </div>

        <div class="campo">
          <label>Documento firmado (PDF)</label>
          <input type="file" accept="application/pdf" (change)="elegirArchivo($event)" />
          @if (archivo) { <small class="ayuda">{{ archivo.name }}</small> }
          @else { <small class="ayuda">Obligatorio al aprobar. Máximo 10 MB.</small> }
        </div>

        <div class="campo">
          <label>Observación</label>
          <textarea pInputTextarea [(ngModel)]="observacion" rows="2"
                    placeholder="Opcional"></textarea>
        </div>

        <div class="pie">
          <button pButton label="Cancelar" severity="secondary" text
                  (click)="dialogoAprobar = false"></button>
          <button pButton label="Rechazar" severity="danger" outlined
                  [loading]="procesando()" (click)="resolver(false)"></button>
          <button pButton label="Aprobar" icon="pi pi-check"
                  [loading]="procesando()" (click)="resolver(true)"></button>
        </div>
      </p-dialog>

      <!-- ---------------------------------------------------- Anular -->
      <p-dialog header="Anular solicitud" [(visible)]="dialogoAnular" [modal]="true"
                [draggable]="false" [style]="{ width: '30rem' }">
        <p class="nota">La solicitud quedará cerrada y no podrá generar
           movimientos. El motivo se guarda en el documento.</p>

        <div class="campo">
          <label>Motivo</label>
          <textarea pInputTextarea [(ngModel)]="motivo" rows="3"
                    placeholder="Por qué se anula"></textarea>
        </div>

        <div class="pie">
          <button pButton label="Cancelar" severity="secondary" text
                  (click)="dialogoAnular = false"></button>
          <button pButton label="Anular solicitud" severity="danger"
                  [loading]="procesando()" (click)="anular()"></button>
        </div>
      </p-dialog>
    }
  `,
  styles: [`
    .pagina h1 { font-size:var(--t-md); }
    .ficha { display:grid; grid-template-columns:repeat(auto-fit, minmax(13rem, 1fr));
             gap:.875rem 1.5rem; padding:1rem 0 1.25rem;
             border-bottom:1px solid var(--linea-tenue); margin-bottom:1.25rem; }
    .ficha > div { display:flex; flex-direction:column; gap:.125rem;
                   font-size:var(--t-sm); }
    .rotulo { font-size:var(--t-xs); color:var(--tinta-suave); }

    .justificacion { display:flex; flex-direction:column; gap:.125rem;
                     font-size:var(--t-sm); max-width:70ch; margin:0 0 1.25rem; }

    .estado { align-self:flex-start; padding:.0625rem .4375rem; border-radius:2px;
              font-size:var(--t-xs); border:1px solid var(--linea);
              color:var(--tinta-suave); }
    .estado-aprobada { border-color:var(--acento); color:var(--acento);
                       background:var(--acento-lavado); }
    .estado-atendida_parcial { border-color:var(--aviso); color:var(--aviso);
                               background:var(--aviso-lavado); }
    .estado-atendida { border-color:var(--bien); color:var(--bien); }
    .estado-rechazada, .estado-anulada { border-color:var(--alerta); color:var(--alerta); }

    .adjunto { display:flex; align-items:center; gap:.625rem; padding:.625rem .875rem;
               border:1px solid var(--linea); border-radius:var(--radio);
               margin-bottom:1.25rem; font-size:var(--t-sm); max-width:30rem; }
    .adjunto i { color:var(--alerta); }
    .adjunto span { flex:1; }

    .pendiente { color:var(--aviso); font-weight:500; }
    .tenue { color:var(--tinta-suave); }

    .nota { font-size:var(--t-sm); color:var(--tinta-suave); margin:0 0 1rem;
            line-height:1.5; }

    .circuito { display:flex; align-items:flex-start; gap:.625rem;
                padding:.75rem .875rem; margin-bottom:1rem;
                border:1px solid var(--linea); border-left:3px solid var(--acento);
                border-radius:var(--radio); background:var(--acento-lavado);
                font-size:var(--t-sm); line-height:1.5; max-width:60ch; }
    .circuito i { color:var(--acento); margin-top:.125rem; }
    .campo { margin-bottom:.875rem; }
    .campo textarea { width:100%; }
    :host ::ng-deep .ancho { width:100%; }
    .pie { display:flex; justify-content:flex-end; gap:.5rem; margin-top:1.25rem;
           padding-top:1rem; border-top:1px solid var(--linea-tenue); }
  `],
})
export class SolicitudDetalleComponent implements OnInit {
  private readonly servicio = inject(SolicitudService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  readonly id = input.required<string>();

  readonly solicitud = signal<SolicitudCompra | null>(null);
  readonly procesando = signal(false);
  readonly imprimiendo = signal(false);
  readonly hoy = new Date();

  dialogoAprobar = false;
  dialogoAnular = false;
  fechaAprobacion = new Date();
  observacion = '';
  motivo = '';
  archivo: File | null = null;

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    /*
     | Si el identificador no es numérico, la URL no corresponde a un documento:
     | lo más probable es un enlace mal armado. Se vuelve a la lista en vez de
     | pedirle al servidor un registro que no existe.
     */
    const id = Number(this.id());

    if (!Number.isFinite(id) || id <= 0) {
      this.router.navigate(['/solicitudes']);
      return;
    }

    this.servicio.obtener('compra', id)
      .subscribe(res => this.solicitud.set(res.data as SolicitudCompra));
  }

  elegirArchivo(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.archivo = entrada.files?.[0] ?? null;
  }

  resolver(aprobada: boolean): void {
    if (aprobada && !this.archivo) {
      this.mensajes.add({
        severity: 'warn',
        summary: 'Falta el documento',
        detail: 'Adjunte el PDF firmado. Sin respaldo, la aprobación no sirve ante una auditoría.',
      });
      return;
    }

    this.procesando.set(true);

    this.servicio.aprobar(
      'compra',
      Number(this.id()),
      aprobada,
      this.aIso(this.fechaAprobacion),
      this.observacion || null,
      this.archivo,
    ).subscribe({
      next: res => {
        this.solicitud.set(res.data as SolicitudCompra);
        this.dialogoAprobar = false;
        this.procesando.set(false);
        this.archivo = null;

        this.mensajes.add({
          severity: 'success',
          summary: aprobada ? 'Aprobación registrada' : 'Solicitud rechazada',
          detail: aprobada
            ? 'Ya puede generar el movimiento contra esta solicitud.'
            : 'La solicitud queda cerrada.',
        });
      },
      error: (error: HttpErrorResponse) => {
        this.procesando.set(false);
        const detalle = error.error?.errors?.documento?.[0] ?? error.error?.message;
        if (detalle) {
          this.mensajes.add({ severity: 'error', summary: 'No se pudo registrar', detail: detalle });
        }
      },
    });
  }

  anular(): void {
    if (!this.motivo.trim()) {
      this.mensajes.add({
        severity: 'warn',
        summary: 'Falta el motivo',
        detail: 'Escriba por qué se anula la solicitud.',
      });
      return;
    }

    this.procesando.set(true);

    this.servicio.anular('compra', Number(this.id()), this.motivo).subscribe({
      next: res => {
        this.solicitud.set(res.data as SolicitudCompra);
        this.dialogoAnular = false;
        this.procesando.set(false);
        this.mensajes.add({ severity: 'success', summary: 'Solicitud anulada' });
        this.cargar();
      },
      error: () => this.procesando.set(false),
    });
  }

  /**
   * Abre el formulario en una pestaña nueva, listo para imprimir.
   * No se descarga a disco: el usuario lo va a mandar a la impresora, no a
   * archivarlo — lo que se archiva es el escaneo firmado.
   */
  imprimir(): void {
    this.imprimiendo.set(true);

    this.servicio.descargarFormulario('compra', Number(this.id())).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        // Se libera con retraso: revocar de inmediato deja la pestaña en blanco.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        this.imprimiendo.set(false);
      },
      error: () => this.imprimiendo.set(false),
    });
  }

  descargar(): void {
    this.servicio.descargarDocumento('compra', Number(this.id())).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = this.solicitud()?.documento_nombre ?? 'solicitud.pdf';
      enlace.click();
      URL.revokeObjectURL(url);
    });
  }

  private aIso(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }
}
