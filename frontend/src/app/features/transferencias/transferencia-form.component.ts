import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { PanelModule } from 'primeng/panel';
import { TableModule } from 'primeng/table';
import { Observable, forkJoin } from 'rxjs';
import { AlmacenCatalogo, ProductoBuscado } from '../../core/models/catalogo.models';
import {
  Transferencia, TransferenciaDetalle, TransferenciaPayload,
} from '../../core/models/transferencia.models';
import { CatalogoService } from '../../core/services/catalogo.service';
import { PermisosService } from '../../core/services/permisos.service';
import { TransferenciaService } from '../../core/services/transferencia.service';
import { ErroresFormulario } from '../../shared/formularios/errores-formulario';
import { ResumenErroresComponent } from '../../shared/formularios/resumen-errores.component';

const ETIQUETAS: Record<string, string> = {
  almacen_destino_id: 'Almacén de destino',
  fecha: 'Fecha',
  transportista: 'Transportista',
  motivo: 'Motivo',
};

@Component({
  selector: 'app-transferencia-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule, ButtonModule, InputTextModule,
    InputTextareaModule, InputNumberModule, DropdownModule, CalendarModule,
    AutoCompleteModule, TableModule, PanelModule, ResumenErroresComponent,
  ],
  template: `
    <form [formGroup]="formulario" (ngSubmit)="guardar()">

      <header class="pagina">
        <div>
          <h1>{{ esNueva() ? 'Nueva transferencia' : transferencia()?.numero }}</h1>
          <p>Queda en borrador. Al despacharla el material sale del almacén de
             origen y queda en tránsito hasta que el destino la reciba.</p>
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

      <p-panel header="Recorrido">
        <div class="recorrido">
          <div class="extremo">
            <span class="rotulo">Sale de</span>
            <span class="almacen">{{ almacenActivo()?.nombre }}</span>
            <small>Es el almacén en el que está trabajando.</small>
          </div>

          <i class="pi pi-arrow-right flecha"></i>

          <div class="extremo campo">
            <label for="destino">Llega a</label>
            <p-dropdown inputId="destino" [options]="destinosPosibles()"
                        formControlName="almacen_destino_id"
                        optionLabel="nombre" optionValue="id" [filter]="true"
                        placeholder="Elija el almacén de destino"
                        styleClass="ancho" appendTo="body" />
            @if (errores.de('almacen_destino_id')) {
              <small class="error">{{ errores.de('almacen_destino_id') }}</small>
            }
          </div>
        </div>

        <div class="rejilla separada">
          <div class="campo">
            <label for="fecha">Fecha</label>
            <p-calendar inputId="fecha" formControlName="fecha" dateFormat="dd/mm/yy"
                        [maxDate]="hoy" [showIcon]="true" styleClass="ancho"
                        appendTo="body" />
            @if (errores.de('fecha')) { <small class="error">{{ errores.de('fecha') }}</small> }
          </div>

          <div class="campo">
            <label for="transportista">Transportista</label>
            <input pInputText id="transportista" formControlName="transportista"
                   placeholder="Quién lleva el material" />
            <small class="ayuda">Figura en la guía de traslado.</small>
          </div>

          <div class="campo ancho-total">
            <label for="motivo">Motivo</label>
            <textarea pInputTextarea id="motivo" formControlName="motivo" rows="2"
                      placeholder="Por qué se traslada el material"></textarea>
          </div>
        </div>
      </p-panel>

      <p-panel header="Material a trasladar">
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
                <span class="saldo" [class.agotado]="!p.disponible">
                  {{ p.disponible ? 'hay ' + p.disponible : 'sin stock' }}
                </span>
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
              <th style="width:7rem" class="cifra">En origen</th>
              <th style="width:9rem" class="cifra">A trasladar</th>
              <th>Observación</th>
              <th style="width:3.5rem"></th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-linea let-i="rowIndex">
            <tr>
              <td><span class="codigo">{{ linea.codigo }}</span></td>
              <td>{{ linea.producto }}</td>
              <td><span class="codigo">{{ linea.unidad }}</span></td>
              <td class="cifra" [class.sin-stock]="!linea.disponible">
                {{ linea.disponible ?? 0 }}
              </td>
              <td>
                <p-inputNumber [(ngModel)]="linea.cantidad"
                               [ngModelOptions]="{ standalone: true }"
                               [min]="0" [max]="linea.disponible ?? 0"
                               [maxFractionDigits]="linea.permite_decimales ? 4 : 0"
                               styleClass="ancho cantidad"
                               [class.excedida]="excede(linea)" />
                @if (excede(linea)) {
                  <small class="tope">Máximo {{ linea.disponible }}</small>
                }
              </td>
              <td>
                <input pInputText [(ngModel)]="linea.observacion"
                       [ngModelOptions]="{ standalone: true }" placeholder="Opcional" />
              </td>
              <td class="fila-acciones">
                <button pButton type="button" icon="pi pi-trash" text rounded
                        severity="danger" (click)="quitar(i)"></button>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr><td colspan="7">
              <div class="vacio">
                <i class="pi pi-list"></i>
                <p>Busque un producto arriba para agregarlo al traslado.</p>
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
    :host ::ng-deep .excedida input { border-color:var(--alerta) !important; }
    .ancho-total { grid-column:1 / -1; }

    /* El recorrido se lee de un vistazo: origen fijo, flecha, destino elegible. */
    .recorrido { display:grid; grid-template-columns:1fr auto 1fr; gap:1.25rem;
                 align-items:center; padding-bottom:1.25rem;
                 border-bottom:1px solid var(--linea-tenue); }
    .extremo { display:flex; flex-direction:column; gap:.25rem; }
    .extremo .rotulo { font-size:var(--t-xs); color:var(--tinta-suave); }
    .extremo .almacen { font-size:var(--t-md); font-weight:600; }
    .extremo small { font-size:var(--t-xs); color:var(--tinta-suave); }
    .flecha { font-size:1.25rem; color:var(--tinta-tenue); }
    .separada { margin-top:1.25rem; }

    .buscador { margin-bottom:1rem; max-width:36rem; }
    .sugerencia { display:flex; gap:.75rem; align-items:baseline; }
    .sugerencia .nombre { flex:1; }
    .sugerencia .unidad { color:var(--tinta-suave); font-size:var(--t-xs); }
    .sugerencia .saldo { font-size:var(--t-xs); color:var(--bien); }
    .sugerencia .saldo.agotado { color:var(--alerta); }

    .sin-stock { color:var(--alerta); }
    .tope { display:block; font-size:var(--t-xs); color:var(--alerta);
            text-align:right; margin-top:.125rem; }
    .fila-acciones { text-align:right; }

    @media (max-width: 50rem) {
      .recorrido { grid-template-columns:1fr; }
      .flecha { transform:rotate(90deg); justify-self:start; }
    }
  `],
})
export class TransferenciaFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly servicio = inject(TransferenciaService);
  private readonly catalogo = inject(CatalogoService);
  private readonly permisos = inject(PermisosService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  readonly id = input<string | undefined>();

  readonly transferencia = signal<Transferencia | null>(null);
  readonly detalles = signal<TransferenciaDetalle[]>([]);
  readonly sugerencias = signal<ProductoBuscado[]>([]);
  readonly almacenes = signal<AlmacenCatalogo[]>([]);
  readonly guardando = signal(false);

  readonly hoy = new Date();
  productoElegido: ProductoBuscado | null = null;

  readonly esNueva = computed(() => !this.id());
  readonly almacenActivo = this.permisos.almacenActivo;

  /** El origen es el almacén activo, así que no puede ser también el destino. */
  readonly destinosPosibles = computed(() => {
    const origen = this.almacenActivo()?.id;
    return this.almacenes().filter(a => a.id !== origen && a.activo);
  });

  readonly formulario = this.fb.nonNullable.group({
    almacen_destino_id: [null as number | null, Validators.required],
    fecha: [new Date(), Validators.required],
    transportista: [''],
    motivo: [''],
  });

  readonly errores = new ErroresFormulario(this.formulario, ETIQUETAS);

  ngOnInit(): void {
    const id = this.id();

    forkJoin({ almacenes: this.catalogo.almacenes(true) })
      .subscribe(({ almacenes }) => this.almacenes.set(almacenes.data));

    if (!id) return;

    this.servicio.obtener(Number(id)).subscribe(res => {
      const t = res.data;
      this.transferencia.set(t);

      if (!t.editable) {
        this.mensajes.add({
          severity: 'warn',
          summary: 'Solo lectura',
          detail: 'Esta transferencia ya no está en borrador.',
        });
        this.router.navigate(['/transferencias', id]);
        return;
      }

      this.formulario.patchValue({
        almacen_destino_id: t.almacen_destino_id,
        fecha: new Date(t.fecha + 'T00:00:00'),
        transportista: t.transportista ?? '',
        motivo: t.motivo ?? '',
      });

      this.detalles.set(t.detalles ?? []);
      this.recuperarSaldos();
    });
  }

  /** El saldo no es un dato del documento sino del almacén ahora mismo. */
  private recuperarSaldos(): void {
    this.detalles().forEach(linea => {
      if (!linea.codigo) return;

      this.catalogo.buscarProductos(linea.codigo).subscribe(res => {
        const encontrado = res.data.find(p => p.id === linea.producto_id);
        if (!encontrado) return;

        this.detalles.update(lista => lista.map(l => l.producto_id === linea.producto_id
          ? { ...l, disponible: encontrado.disponible,
              permite_decimales: encontrado.permite_decimales }
          : l));
      });
    });
  }

  buscarProducto(evento: { query: string }): void {
    this.catalogo.buscarProductos(evento.query)
      .subscribe(res => this.sugerencias.set(res.data));
  }

  agregar(evento: { value: ProductoBuscado } | ProductoBuscado): void {
    const producto = 'value' in evento ? evento.value : evento;

    if (!producto.disponible) {
      this.mensajes.add({
        severity: 'warn',
        summary: 'Sin existencias',
        detail: `No hay ${producto.nombre} en este almacén.`,
      });
      this.productoElegido = null;
      return;
    }

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
      cantidad: Math.min(1, producto.disponible),
      cantidad_recibida: null,
      observacion: null,
      disponible: producto.disponible,
      permite_decimales: producto.permite_decimales,
    }]);

    this.productoElegido = null;
  }

  excede(linea: TransferenciaDetalle): boolean {
    return (linea.cantidad ?? 0) > (linea.disponible ?? 0);
  }

  quitar(indice: number): void {
    this.detalles.update(lista => lista.filter((_, i) => i !== indice));
  }

  guardar(): void {
    const extras: string[] = [];

    if (!this.detalles().length) {
      extras.push('Agregue al menos un producto.');
    }

    const sinCantidad = this.detalles().filter(d => !d.cantidad || d.cantidad <= 0);
    if (sinCantidad.length) {
      extras.push(`Indique una cantidad mayor que cero en: ${
        sinCantidad.map(d => d.codigo).join(', ')}.`);
    }

    this.detalles().filter(d => this.excede(d)).forEach(d => extras.push(
      `Solo hay ${d.disponible} de ${d.producto}; no se puede trasladar ${d.cantidad}.`,
    ));

    if (!this.errores.validar(extras)) return;

    this.guardando.set(true);
    const v = this.formulario.getRawValue();

    const carga: TransferenciaPayload = {
      almacen_destino_id: v.almacen_destino_id!,
      fecha: this.aIso(v.fecha),
      transportista: v.transportista || null,
      motivo: v.motivo || null,
      detalles: this.detalles().map(d => ({
        producto_id: d.producto_id,
        cantidad: d.cantidad,
        observacion: d.observacion || null,
      })),
    };

    const id = this.id();

    const peticion: Observable<unknown> = id
      ? this.servicio.actualizar(Number(id), carga)
      : this.servicio.crear(carga);

    peticion.subscribe({
      next: res => {
        this.mensajes.add({
          severity: 'success',
          summary: id ? 'Transferencia actualizada' : 'Transferencia registrada',
          detail: 'Imprima la guía y despáchela cuando el material salga.',
        });

        const destino = id ?? (res as Transferencia)?.id;
        this.router.navigate(destino ? ['/transferencias', destino] : ['/transferencias']);
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
    this.router.navigate(['/transferencias']);
  }
}
