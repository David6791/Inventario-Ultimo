import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { PanelModule } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { Observable } from 'rxjs';
import { ProductoBuscado } from '../../core/models/catalogo.models';
import {
  Solicitud, SolicitudDetalle, SolicitudPayload,
} from '../../core/models/solicitud.models';
import { CatalogoService } from '../../core/services/catalogo.service';
import { PermisosService } from '../../core/services/permisos.service';
import { SolicitudService } from '../../core/services/solicitud.service';
import { ErroresFormulario } from '../../shared/formularios/errores-formulario';
import { ResumenErroresComponent } from '../../shared/formularios/resumen-errores.component';

const ETIQUETAS: Record<string, string> = {
  fecha: 'Fecha',
  unidad_solicitante: 'Unidad solicitante',
  solicitante: 'Solicitante',
  justificacion: 'Justificación',
  partida_presupuestaria: 'Partida presupuestaria',
  monto_estimado: 'Monto estimado',
};

@Component({
  selector: 'app-solicitud-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule, ButtonModule, InputTextModule,
    InputTextareaModule, InputNumberModule, CalendarModule, AutoCompleteModule,
    TableModule, PanelModule, ResumenErroresComponent,
  ],
  template: `
    <form [formGroup]="formulario" (ngSubmit)="guardar()">

      <header class="pagina">
        <div>
          <h1>{{ titulo() }}</h1>
          <p>Pide material que entrará al almacén. Una vez aprobada, el ingreso
             se registra contra ella y descuenta sus saldos.</p>
        </div>
        <div class="acciones">
          <button pButton type="button" label="Cancelar" severity="secondary" text
                  (click)="volver()"></button>
          <button pButton type="submit" icon="pi pi-check"
                  [label]="esNueva() ? 'Guardar borrador' : 'Guardar cambios'"
                  [loading]="guardando()"></button>
        </div>
      </header>

      <app-resumen-errores [problemas]="errores.resumen()" />

      <p-panel header="Datos de la solicitud">
        <div class="rejilla">
          <div class="campo">
            <label for="fecha">Fecha</label>
            <p-calendar inputId="fecha" formControlName="fecha" dateFormat="dd/mm/yy"
                        [maxDate]="hoy" [showIcon]="true" styleClass="ancho"
                        appendTo="body" />
            @if (errores.de('fecha')) { <small class="error">{{ errores.de('fecha') }}</small> }
          </div>

          <div class="campo">
            <label for="unidad">Unidad solicitante</label>
            <input pInputText id="unidad" formControlName="unidad_solicitante"
                   placeholder="Dirección Administrativa Financiera" />
            @if (errores.de('unidad_solicitante')) {
              <small class="error">{{ errores.de('unidad_solicitante') }}</small>
            }
          </div>

          <div class="campo">
            <label for="solicitante">Solicitante</label>
            <input pInputText id="solicitante" formControlName="solicitante"
                   placeholder="Nombre de quien firma la solicitud" />
            @if (errores.de('solicitante')) {
              <small class="error">{{ errores.de('solicitante') }}</small>
            }
          </div>

          <div class="campo">
            <label for="partida">Partida presupuestaria</label>
            <input pInputText id="partida" formControlName="partida_presupuestaria"
                   class="codigo" placeholder="34200" />
          </div>

          <div class="campo">
            <label for="monto">Monto estimado (Bs)</label>
            <p-inputNumber inputId="monto" formControlName="monto_estimado"
                           mode="decimal" [minFractionDigits]="2" [min]="0"
                           styleClass="ancho" />
            <small class="ayuda">Referencial. Sirve para saber qué modalidad de contratación corresponde.</small>
          </div>

          <div class="campo ancho-total">
            <label for="justificacion">Justificación</label>
            <textarea pInputTextarea id="justificacion" formControlName="justificacion" rows="2"
                      placeholder="Para qué se necesita el material"></textarea>
          </div>
        </div>
      </p-panel>

      <p-panel header="Detalle">
        <div class="buscador">
          <p-autoComplete [(ngModel)]="productoElegido" [ngModelOptions]="{ standalone: true }"
                          [suggestions]="sugerencias()" (completeMethod)="buscarProducto($event)"
                          (onSelect)="agregar($event)"
                          optionLabel="nombre" placeholder="Escriba código o nombre para agregar"
                          styleClass="ancho" appendTo="body" [minLength]="2">
            <ng-template let-p pTemplate="item">
              <div class="sugerencia">
                <span class="codigo">{{ p.codigo }}</span>
                <span class="nombre">{{ p.nombre }}</span>
                <span class="unidad">{{ p.unidad }}</span>
              </div>
            </ng-template>
          </p-autoComplete>
        </div>

        <p-table [value]="detalles()" dataKey="producto_id" styleClass="p-datatable-sm">
          <ng-template pTemplate="header">
            <tr>
              <th style="width:9rem">Código</th>
              <th>Producto</th>
              <th style="width:4.5rem">Unidad</th>
              <th style="width:9rem" class="cifra">Cantidad</th>
              <th>Especificación</th>
              <th style="width:3.5rem"></th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-linea let-i="rowIndex">
            <tr>
              <td><span class="codigo">{{ linea.codigo }}</span></td>
              <td>{{ linea.producto }}</td>
              <td><span class="codigo">{{ linea.unidad }}</span></td>

              <td>
                <p-inputNumber [(ngModel)]="linea.cantidad"
                               [ngModelOptions]="{ standalone: true }"
                               [min]="0" [maxFractionDigits]="4"
                               styleClass="ancho cantidad" />
              </td>
              <td>
                <input pInputText [(ngModel)]="linea.especificacion"
                       [ngModelOptions]="{ standalone: true }"
                       placeholder="Marca, color, medida" />
              </td>
              <td class="fila-acciones">
                <button pButton type="button" icon="pi pi-trash" text rounded
                        severity="danger" (click)="quitar(i)"></button>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr><td colspan="6">
              <div class="vacio">
                <i class="pi pi-list"></i>
                <p>Busque un producto arriba para agregarlo a la solicitud.</p>
              </div>
            </td></tr>
          </ng-template>
        </p-table>
      </p-panel>
    </form>
  `,
  styles: [`
    :host ::ng-deep p-panel { display:block; margin-bottom:1rem; }
    :host ::ng-deep .ancho, :host ::ng-deep .ancho input { width:100%; }
    :host ::ng-deep .cantidad input { text-align:right;
                                      font-variant-numeric:tabular-nums; }
    .ancho-total { grid-column:1 / -1; }
    .buscador { margin-bottom:1rem; max-width:36rem; }

    .sugerencia { display:flex; gap:.75rem; align-items:baseline; }
    .sugerencia .nombre { flex:1; }
    .sugerencia .unidad { color:var(--tinta-suave); font-size:var(--t-xs); }


    .fila-acciones { text-align:right; }
  `],
})
export class SolicitudFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly servicio = inject(SolicitudService);
  private readonly catalogo = inject(CatalogoService);
  private readonly permisos = inject(PermisosService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  readonly id = input<string | undefined>();

  readonly solicitud = signal<Solicitud | null>(null);
  readonly detalles = signal<SolicitudDetalle[]>([]);
  readonly sugerencias = signal<ProductoBuscado[]>([]);
  readonly guardando = signal(false);

  readonly hoy = new Date();
  productoElegido: ProductoBuscado | null = null;

  readonly esNueva = computed(() => !this.id());
  readonly titulo = computed(() =>
    this.esNueva() ? 'Nueva solicitud de compra' : (this.solicitud()?.numero ?? 'Solicitud'));

  readonly formulario = this.fb.nonNullable.group({
    fecha: [new Date(), Validators.required],
    unidad_solicitante: ['', [Validators.required, Validators.maxLength(150)]],
    solicitante: ['', [Validators.required, Validators.maxLength(150)]],
    justificacion: [''],
    observaciones: [''],
    partida_presupuestaria: [''],
    monto_estimado: [null as number | null],
  });

  readonly errores = new ErroresFormulario(this.formulario, ETIQUETAS);

  ngOnInit(): void {
    const id = this.id();

    if (!id) {
      // Precarga razonable: quien registra suele ser quien firma.
      this.formulario.patchValue({
        solicitante: this.permisos.usuario()?.name ?? '',
      });
      return;
    }

    this.servicio.obtener('compra', Number(id)).subscribe(res => {
      const solicitud = res.data;
      this.solicitud.set(solicitud);

      if (!solicitud.editable) {
        this.mensajes.add({
          severity: 'warn',
          summary: 'Solo lectura',
          detail: 'Esta solicitud ya no está en borrador.',
        });
        this.router.navigate(['/solicitudes', id]);
        return;
      }

      this.formulario.patchValue({
        fecha: new Date(solicitud.fecha + 'T00:00:00'),
        unidad_solicitante: solicitud.unidad_solicitante,
        solicitante: solicitud.solicitante,
        justificacion: solicitud.justificacion ?? '',
        observaciones: solicitud.observaciones ?? '',
        partida_presupuestaria: solicitud.partida_presupuestaria ?? '',
        monto_estimado: solicitud.monto_estimado,
      });

      this.detalles.set(solicitud.detalles ?? []);
    });
  }

  buscarProducto(evento: { query: string }): void {
    this.catalogo.buscarProductos(evento.query)
      .subscribe(res => this.sugerencias.set(res.data));
  }

  agregar(evento: { value: ProductoBuscado } | ProductoBuscado): void {
    const producto = 'value' in evento ? evento.value : evento;

    // Un producto repetido rompe la clave única del detalle y confunde los
    // saldos. Si ya está, se avisa en vez de agregar una segunda línea.
    if (this.detalles().some(d => d.producto_id === producto.id)) {
      this.mensajes.add({
        severity: 'warn',
        summary: 'Ya está en el detalle',
        detail: `${producto.nombre}. Modifique la cantidad en la línea existente.`,
      });
      this.productoElegido = null;
      return;
    }

    this.detalles.update(lista => [...lista, {
      producto_id: producto.id,
      codigo: producto.codigo,
      producto: producto.nombre,
      unidad: producto.unidad,
      cantidad: 1,
      especificacion: null,
    }]);

    this.productoElegido = null;
  }

  quitar(indice: number): void {
    this.detalles.update(lista => lista.filter((_, i) => i !== indice));
  }

  guardar(): void {
    const extras: string[] = [];

    if (!this.detalles().length) {
      extras.push('Agregue al menos un producto a la solicitud.');
    }

    const sinCantidad = this.detalles().filter(d => !d.cantidad || d.cantidad <= 0);
    if (sinCantidad.length) {
      extras.push(`Indique una cantidad mayor que cero en: ${
        sinCantidad.map(d => d.codigo).join(', ')}.`);
    }

    if (!this.errores.validar(extras)) return;

    this.guardando.set(true);
    const v = this.formulario.getRawValue();

    const carga: SolicitudPayload = {
      fecha: this.aIso(v.fecha),
      unidad_solicitante: v.unidad_solicitante,
      solicitante: v.solicitante,
      justificacion: v.justificacion || null,
      observaciones: v.observaciones || null,
      detalles: this.detalles().map(d => ({
        producto_id: d.producto_id,
        cantidad: d.cantidad,
        especificacion: d.especificacion || null,
      })),
      partida_presupuestaria: v.partida_presupuestaria || null,
      monto_estimado: v.monto_estimado,
    };

    const id = this.id();

    const peticion: Observable<unknown> = id
      ? this.servicio.actualizar('compra', Number(id), carga)
      : this.servicio.crear('compra', carga);

    peticion.subscribe({
      next: () => {
        this.mensajes.add({
          severity: 'success',
          summary: id ? 'Solicitud actualizada' : 'Solicitud registrada',
          detail: 'Queda en borrador. Imprímala, hágala firmar y registre la aprobación.',
        });
        this.router.navigate(['/solicitudes']);
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errores.desdeServidor(error);
      },
    });
  }

  /** El backend espera fecha sin hora ni zona. */
  private aIso(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }

  volver(): void {
    this.router.navigate(['/solicitudes']);
  }
}
