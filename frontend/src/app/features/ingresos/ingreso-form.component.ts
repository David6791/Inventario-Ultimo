import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { PanelModule } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { Observable } from 'rxjs';
import {
  Ingreso, IngresoDetalle, IngresoPayload, SolicitudPendiente, TIPOS_DOCUMENTO,
} from '../../core/models/ingreso.models';
import { IngresoService } from '../../core/services/ingreso.service';
import { ErroresFormulario } from '../../shared/formularios/errores-formulario';
import { ResumenErroresComponent } from '../../shared/formularios/resumen-errores.component';

const ETIQUETAS: Record<string, string> = {
  solicitud_compra_id: 'Solicitud de compra',
  fecha: 'Fecha de recepción',
  proveedor: 'Proveedor',
  tipo_documento: 'Tipo de documento',
  numero_documento: 'Número de documento',
  fecha_documento: 'Fecha del documento',
};

@Component({
  selector: 'app-ingreso-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule, DecimalPipe, ButtonModule, InputTextModule,
    InputTextareaModule, InputNumberModule, DropdownModule, CalendarModule,
    TableModule, PanelModule, ResumenErroresComponent,
  ],
  template: `
    <form [formGroup]="formulario" (ngSubmit)="guardar()">

      <header class="pagina">
        <div>
          <h1>{{ esNuevo() ? 'Registrar ingreso' : ingreso()?.numero }}</h1>
          <p>Queda en borrador. Al confirmarlo entra el material al almacén y
             el precio que cargue acá pasa a ser el costo del inventario.</p>
        </div>
        <div class="acciones">
          <button pButton type="button" label="Cancelar" severity="secondary" text
                  (click)="volver()"></button>
          <button pButton type="submit" icon="pi pi-check"
                  [label]="esNuevo() ? 'Guardar borrador' : 'Guardar cambios'"
                  [loading]="guardando()"></button>
        </div>
      </header>

      <app-resumen-errores [problemas]="errores.resumen()" />

      <p-panel header="Solicitud que se atiende">
        @if (esNuevo()) {
          <div class="campo selector">
            <label for="solicitud">Solicitud de compra</label>
            <p-dropdown inputId="solicitud" [options]="solicitudes()"
                        formControlName="solicitud_compra_id"
                        optionLabel="numero" optionValue="id" [filter]="true"
                        placeholder="Elija la solicitud aprobada que llegó"
                        styleClass="ancho" appendTo="body"
                        (onChange)="elegirSolicitud($event.value)">
              <ng-template let-s pTemplate="item">
                <div class="opcion-solicitud">
                  <span class="codigo">{{ s.numero }}</span>
                  <span class="unidad">{{ s.unidad_solicitante }}</span>
                  <small>{{ s.detalles.length }} ítem(s) por recibir</small>
                </div>
              </ng-template>
            </p-dropdown>
            @if (errores.de('solicitud_compra_id')) {
              <small class="error">{{ errores.de('solicitud_compra_id') }}</small>
            } @else if (!solicitudes().length) {
              <small class="ayuda alerta">
                No hay solicitudes aprobadas con saldo pendiente. Apruebe una
                solicitud de compra antes de registrar el ingreso.
              </small>
            }
          </div>
        } @else {
          <p class="fijo">
            <span class="codigo">{{ ingreso()?.solicitud_numero }}</span>
            <small>La solicitud no se puede cambiar una vez creado el ingreso.</small>
          </p>
        }
      </p-panel>

      <p-panel header="Documento del proveedor">
        <div class="rejilla">
          <div class="campo">
            <label for="fecha">Fecha de recepción</label>
            <p-calendar inputId="fecha" formControlName="fecha" dateFormat="dd/mm/yy"
                        [maxDate]="hoy" [showIcon]="true" styleClass="ancho"
                        appendTo="body" />
            @if (errores.de('fecha')) { <small class="error">{{ errores.de('fecha') }}</small> }
          </div>

          <div class="campo ancho-doble">
            <label for="proveedor">Proveedor</label>
            <input pInputText id="proveedor" formControlName="proveedor"
                   placeholder="Razón social de quien entregó" />
            @if (errores.de('proveedor')) { <small class="error">{{ errores.de('proveedor') }}</small> }
          </div>

          <div class="campo">
            <label for="tipo">Tipo de documento</label>
            <p-dropdown inputId="tipo" [options]="tiposDocumento" formControlName="tipo_documento"
                        optionLabel="etiqueta" optionValue="valor" styleClass="ancho"
                        appendTo="body" />
            @if (errores.de('tipo_documento')) {
              <small class="error">{{ errores.de('tipo_documento') }}</small>
            }
          </div>

          <div class="campo">
            <label for="numdoc">Número</label>
            <input pInputText id="numdoc" formControlName="numero_documento" class="codigo" />
          </div>

          <div class="campo">
            <label for="fechadoc">Fecha del documento</label>
            <p-calendar inputId="fechadoc" formControlName="fecha_documento"
                        dateFormat="dd/mm/yy" [maxDate]="hoy" [showIcon]="true"
                        styleClass="ancho" appendTo="body" />
          </div>

          <div class="campo ancho-total">
            <label for="obs">Observaciones</label>
            <textarea pInputTextarea id="obs" formControlName="observaciones" rows="2"
                      placeholder="Diferencias, estado del material, faltantes"></textarea>
          </div>
        </div>
      </p-panel>

      <p-panel header="Material recibido">
        @if (!detalles().length) {
          <div class="vacio">
            <i class="pi pi-inbox"></i>
            <p>Elija arriba la solicitud de compra: sus líneas pendientes se
               cargan solas.</p>
          </div>
        } @else {
          <p class="nota">Ajuste la cantidad a lo que realmente llegó. Si el
             proveedor entregó de menos, el saldo queda pendiente en la solicitud
             y se recibe en un segundo ingreso.</p>

          <p-table [value]="detalles()" dataKey="solicitud_compra_detalle_id"
                   styleClass="p-datatable-sm">
            <ng-template pTemplate="header">
              <tr>
                <th style="width:8rem">Código</th>
                <th>Producto</th>
                <th style="width:4.5rem">Unidad</th>
                <th style="width:6rem" class="cifra">Pendiente</th>
                <th style="width:8rem" class="cifra">Recibido</th>
                <th style="width:9rem" class="cifra">P. unitario</th>
                <th style="width:9rem" class="cifra">Importe</th>
                <th style="width:3.5rem"></th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-linea let-i="rowIndex">
              <tr [class.excluida]="!linea.cantidad">
                <td><span class="codigo">{{ linea.codigo }}</span></td>
                <td>
                  {{ linea.producto }}
                  @if (linea.controla_lote || linea.controla_vencimiento) {
                    <div class="trazabilidad">
                      @if (linea.controla_lote) {
                        <input pInputText [(ngModel)]="linea.lote"
                               [ngModelOptions]="{ standalone: true }"
                               placeholder="Lote" class="mini codigo" />
                      }
                      @if (linea.controla_vencimiento) {
                        <p-calendar [(ngModel)]="linea.vencimiento"
                                    [ngModelOptions]="{ standalone: true }"
                                    dateFormat="dd/mm/yy" placeholder="Vencimiento"
                                    [minDate]="hoy" styleClass="mini" appendTo="body" />
                      }
                    </div>
                  }
                </td>
                <td><span class="codigo">{{ linea.unidad }}</span></td>
                <td class="cifra tenue">{{ linea.saldo }}</td>
                <td>
                  <p-inputNumber [(ngModel)]="linea.cantidad"
                                 [ngModelOptions]="{ standalone: true }"
                                 [min]="0" [max]="linea.saldo"
                                 [maxFractionDigits]="linea.permite_decimales ? 4 : 0"
                                 styleClass="ancho cifra-campo" />
                </td>
                <td>
                  <p-inputNumber [(ngModel)]="linea.costo_unitario"
                                 [ngModelOptions]="{ standalone: true }"
                                 mode="decimal" [minFractionDigits]="2"
                                 [maxFractionDigits]="4" [min]="0"
                                 styleClass="ancho cifra-campo" />
                </td>
                <td class="cifra importe">
                  {{ (linea.cantidad ?? 0) * (linea.costo_unitario ?? 0) | number:'1.2-2' }}
                </td>
                <td class="fila-acciones">
                  <button pButton type="button" icon="pi pi-times" text rounded
                          severity="danger" pTooltip="Quitar de este ingreso"
                          (click)="quitar(i)"></button>
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="footer">
              <tr>
                <td colspan="6" class="cifra total-rotulo">Total en bolivianos</td>
                <td class="cifra total">{{ total() | number:'1.2-2' }}</td>
                <td></td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-panel>
    </form>
  `,
  styles: [`
    :host ::ng-deep p-panel { display:block; margin-bottom:1rem; }
    :host ::ng-deep .ancho, :host ::ng-deep .ancho input { width:100%; }
    :host ::ng-deep .cifra-campo input { text-align:right;
                                         font-variant-numeric:tabular-nums; }
    :host ::ng-deep .mini input { font-size:var(--t-xs); padding:.25rem .375rem; }
    .ancho-doble { grid-column:span 2; }
    .ancho-total { grid-column:1 / -1; }
    .selector { max-width:34rem; }

    .opcion-solicitud { display:flex; flex-direction:column; gap:.0625rem; }
    .opcion-solicitud .unidad { font-size:var(--t-sm); }
    .opcion-solicitud small { font-size:var(--t-xs); color:var(--tinta-suave); }

    .fijo { display:flex; flex-direction:column; gap:.125rem; margin:0; }
    .fijo small { font-size:var(--t-xs); color:var(--tinta-suave); }

    .trazabilidad { display:flex; gap:.375rem; margin-top:.25rem; max-width:20rem; }
    .tenue { color:var(--tinta-suave); }
    .importe { font-variant-numeric:tabular-nums; }
    .excluida { opacity:.5; }
    .fila-acciones { text-align:right; }

    .total-rotulo { color:var(--tinta-suave); font-size:var(--t-sm); }
    .total { font-weight:600; font-size:var(--t-base); }
    .nota { font-size:var(--t-sm); color:var(--tinta-suave); margin:0 0 .875rem;
            line-height:1.5; max-width:70ch; }
    .ayuda.alerta { color:var(--aviso); }
  `],
})
export class IngresoFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly servicio = inject(IngresoService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  readonly id = input<string | undefined>();

  readonly ingreso = signal<Ingreso | null>(null);
  readonly solicitudes = signal<SolicitudPendiente[]>([]);
  readonly detalles = signal<(IngresoDetalle & { vencimiento?: Date | null })[]>([]);
  readonly guardando = signal(false);

  readonly hoy = new Date();
  readonly tiposDocumento = TIPOS_DOCUMENTO;

  readonly esNuevo = computed(() => !this.id());

  readonly total = computed(() =>
    this.detalles().reduce(
      (suma, d) => suma + (d.cantidad ?? 0) * (d.costo_unitario ?? 0), 0,
    ));

  readonly formulario = this.fb.nonNullable.group({
    solicitud_compra_id: [null as number | null, Validators.required],
    fecha: [new Date(), Validators.required],
    proveedor: ['', [Validators.required, Validators.maxLength(200)]],
    tipo_documento: ['factura', Validators.required],
    numero_documento: [''],
    fecha_documento: [null as Date | null],
    observaciones: [''],
  });

  readonly errores = new ErroresFormulario(this.formulario, ETIQUETAS);

  ngOnInit(): void {
    const id = this.id();

    if (!id) {
      this.servicio.pendientes()
        .subscribe(res => this.solicitudes.set(res.data));
      return;
    }

    // Al editar, la solicitud queda fija: cambiarla dejaría los saldos mal.
    this.formulario.controls.solicitud_compra_id.disable();

    this.servicio.obtener(Number(id)).subscribe(res => {
      const ingreso = res.data;
      this.ingreso.set(ingreso);

      if (!ingreso.editable) {
        this.mensajes.add({
          severity: 'warn',
          summary: 'Solo lectura',
          detail: 'Este ingreso ya no está en borrador.',
        });
        this.router.navigate(['/ingresos', id]);
        return;
      }

      this.formulario.patchValue({
        solicitud_compra_id: ingreso.solicitud_compra_id,
        fecha: new Date(ingreso.fecha + 'T00:00:00'),
        proveedor: ingreso.proveedor,
        tipo_documento: ingreso.tipo_documento,
        numero_documento: ingreso.numero_documento ?? '',
        fecha_documento: ingreso.fecha_documento
          ? new Date(ingreso.fecha_documento + 'T00:00:00') : null,
        observaciones: ingreso.observaciones ?? '',
      });

      this.detalles.set((ingreso.detalles ?? []).map(d => ({
        ...d,
        vencimiento: d.fecha_vencimiento ? new Date(d.fecha_vencimiento + 'T00:00:00') : null,
        // Al editar, el saldo pendiente incluye lo que ya declara este borrador.
        saldo: (d.saldo ?? 0) + d.cantidad,
      })));
    });
  }

  /** Carga las líneas pendientes de la solicitud elegida. */
  elegirSolicitud(id: number): void {
    const solicitud = this.solicitudes().find(s => s.id === id);

    if (!solicitud) {
      this.detalles.set([]);
      return;
    }

    this.detalles.set(solicitud.detalles.map(linea => ({
      producto_id: linea.producto_id,
      solicitud_compra_detalle_id: linea.solicitud_compra_detalle_id,
      codigo: linea.codigo,
      producto: linea.producto,
      unidad: linea.unidad,

      // Se precarga el saldo completo: lo habitual es que llegue todo.
      cantidad: linea.saldo,
      costo_unitario: 0,

      lote: null,
      fecha_vencimiento: null,
      vencimiento: null,
      observacion: null,

      saldo: linea.saldo,
      cantidad_solicitada: linea.cantidad_solicitada,
      permite_decimales: linea.permite_decimales,
      controla_lote: linea.controla_lote,
      controla_vencimiento: linea.controla_vencimiento,
    })));
  }

  quitar(indice: number): void {
    this.detalles.update(lista => lista.filter((_, i) => i !== indice));
  }

  guardar(): void {
    const extras: string[] = [];

    const recibidas = this.detalles().filter(d => (d.cantidad ?? 0) > 0);

    if (!recibidas.length) {
      extras.push('Indique al menos un producto con cantidad recibida.');
    }

    const sinPrecio = recibidas.filter(d => d.costo_unitario === null || d.costo_unitario === undefined);
    if (sinPrecio.length) {
      extras.push(`Falta el precio unitario en: ${sinPrecio.map(d => d.codigo).join(', ')}.`);
    }

    const excedidas = recibidas.filter(d => (d.cantidad ?? 0) > (d.saldo ?? 0));
    excedidas.forEach(d => extras.push(
      `De ${d.producto} quedan ${d.saldo} pendientes; no se puede recibir ${d.cantidad}.`,
    ));

    // El lote y el vencimiento son obligatorios si el producto los controla:
    // sin eso el reporte de vencimientos no sirve de nada.
    recibidas.filter(d => d.controla_lote && !d.lote)
      .forEach(d => extras.push(`Indique el número de lote de ${d.producto}.`));

    recibidas.filter(d => d.controla_vencimiento && !d.vencimiento)
      .forEach(d => extras.push(`Indique la fecha de vencimiento de ${d.producto}.`));

    if (!this.errores.validar(extras)) return;

    this.guardando.set(true);
    const v = this.formulario.getRawValue();

    const carga: IngresoPayload = {
      fecha: this.aIso(v.fecha),
      proveedor: v.proveedor,
      tipo_documento: v.tipo_documento as IngresoPayload['tipo_documento'],
      numero_documento: v.numero_documento || null,
      fecha_documento: v.fecha_documento ? this.aIso(v.fecha_documento) : null,
      observaciones: v.observaciones || null,
      detalles: recibidas.map(d => ({
        solicitud_compra_detalle_id: d.solicitud_compra_detalle_id,
        cantidad: d.cantidad,
        costo_unitario: d.costo_unitario,
        lote: d.lote || null,
        fecha_vencimiento: d.vencimiento ? this.aIso(d.vencimiento) : null,
        observacion: d.observacion || null,
      })),
      ...(this.esNuevo() ? { solicitud_compra_id: v.solicitud_compra_id! } : {}),
    };

    const id = this.id();

    const peticion: Observable<unknown> = id
      ? this.servicio.actualizar(Number(id), carga)
      : this.servicio.crear(carga);

    peticion.subscribe({
      next: res => {
        this.mensajes.add({
          severity: 'success',
          summary: id ? 'Ingreso actualizado' : 'Ingreso registrado',
          detail: 'Revise el detalle y confírmelo para que entre el material.',
        });

        const destino = id ?? (res as Ingreso)?.id;
        this.router.navigate(destino ? ['/ingresos', destino] : ['/ingresos']);
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errores.desdeServidor(error);
      },
    });
  }

  private aIso(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  volver(): void {
    this.router.navigate(['/ingresos']);
  }
}
