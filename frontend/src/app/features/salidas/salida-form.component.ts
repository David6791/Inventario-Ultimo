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
import { ProductoBuscado } from '../../core/models/catalogo.models';
import { Salida, SalidaDetalle, SalidaPayload } from '../../core/models/salida.models';
import { CatalogoService } from '../../core/services/catalogo.service';
import { SalidaService } from '../../core/services/salida.service';
import { Solicitante, UnidadSolicitante } from '../../core/models/solicitante.models';
import { SolicitanteService } from '../../core/services/solicitante.service';
import { ErroresFormulario } from '../../shared/formularios/errores-formulario';
import { ResumenErroresComponent } from '../../shared/formularios/resumen-errores.component';

const ETIQUETAS: Record<string, string> = {
  fecha: 'Fecha',
  unidad_solicitante_id: 'Unidad solicitante',
  solicitante_id: 'Solicitante',
  recibido_por_id: 'Quien recibe',
  centro_costo: 'Centro de costo',
  destino: 'Destino',
  motivo: 'Motivo',
};

@Component({
  selector: 'app-salida-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule, ButtonModule, InputTextModule,
    InputTextareaModule, InputNumberModule, DropdownModule, CalendarModule,
    AutoCompleteModule,
    TableModule, PanelModule, ResumenErroresComponent,
  ],
  template: `
    <form [formGroup]="formulario" (ngSubmit)="guardar()">

      <header class="pagina">
        <div>
          <h1>{{ esNueva() ? 'Registrar salida' : salida()?.numero }}</h1>
          <p>Queda en borrador. Imprima la nota, hágala firmar por quien retira y
             después confírmela: ahí se descuentan las existencias.</p>
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

      <p-panel header="Datos de la entrega">
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
            <p-dropdown inputId="unidad" [options]="unidades()"
                        formControlName="unidad_solicitante_id"
                        optionLabel="nombre" optionValue="id" [filter]="true"
                        placeholder="Elija la unidad" styleClass="ancho"
                        appendTo="body" />
            @if (errores.de('unidad_solicitante_id')) {
              <small class="error">{{ errores.de('unidad_solicitante_id') }}</small>
            }
          </div>

          <div class="campo">
            <label for="solicitante">Solicitante</label>
            <p-dropdown inputId="solicitante" [options]="personasDeLaUnidad()"
                        formControlName="solicitante_id"
                        optionLabel="nombre" optionValue="id" [filter]="true"
                        [placeholder]="formulario.value.unidad_solicitante_id
                          ? 'Quién pide el material'
                          : 'Elija primero la unidad'"
                        [disabled]="!formulario.value.unidad_solicitante_id"
                        styleClass="ancho" appendTo="body">
              <ng-template let-p pTemplate="item">
                <div class="opcion-persona">
                  <span>{{ p.nombre }}</span>
                  @if (p.cargo) { <small>{{ p.cargo }}</small> }
                </div>
              </ng-template>
            </p-dropdown>
            @if (errores.de('solicitante_id')) {
              <small class="error">{{ errores.de('solicitante_id') }}</small>
            } @else if (formulario.value.unidad_solicitante_id && !personasDeLaUnidad().length) {
              <small class="ayuda alerta">
                Esa unidad no tiene gente registrada. Cárguela en Catálogos → Unidades y solicitantes.
              </small>
            }
          </div>

          <div class="campo">
            <label for="recibe">Quien recibe</label>
            <p-dropdown inputId="recibe" [options]="quienesRetiran()"
                        formControlName="recibido_por_id"
                        optionLabel="nombre" optionValue="id" [filter]="true"
                        placeholder="Quién retira y firma" styleClass="ancho"
                        appendTo="body">
              <ng-template let-p pTemplate="item">
                <div class="opcion-persona">
                  <span>{{ p.nombre }}</span>
                  <small>{{ p.unidad }}</small>
                </div>
              </ng-template>
            </p-dropdown>
            @if (errores.de('recibido_por_id')) {
              <small class="error">{{ errores.de('recibido_por_id') }}</small>
            } @else {
              <small class="ayuda">Es el nombre que aparece en la línea de firma.
                Solo figuran quienes están autorizados a retirar.</small>
            }
          </div>

          <div class="campo">
            <label for="centro">Centro de costo</label>
            <input pInputText id="centro" formControlName="centro_costo"
                   class="codigo" placeholder="Opcional" />
          </div>

          <div class="campo">
            <label for="destino">Destino</label>
            <input pInputText id="destino" formControlName="destino"
                   placeholder="Oficina o proyecto que recibe" />
          </div>

          <div class="campo ancho-total">
            <label for="motivo">Motivo</label>
            <textarea pInputTextarea id="motivo" formControlName="motivo" rows="2"
                      placeholder="Para qué se entrega el material"></textarea>
          </div>
        </div>
      </p-panel>

      <p-panel header="Material entregado">
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
              <th style="width:7rem" class="cifra">Disponible</th>
              <th style="width:9rem" class="cifra">Cantidad</th>
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
                       [ngModelOptions]="{ standalone: true }"
                       placeholder="Opcional" />
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
                <p>Busque un producto arriba para agregarlo a la salida.</p>
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
    .buscador { margin-bottom:1rem; max-width:36rem; }

    .sugerencia { display:flex; gap:.75rem; align-items:baseline; }
    .sugerencia .nombre { flex:1; }
    .sugerencia .unidad { color:var(--tinta-suave); font-size:var(--t-xs); }
    .sugerencia .saldo { font-size:var(--t-xs); color:var(--bien); }
    .sugerencia .saldo.agotado { color:var(--alerta); }

    .opcion-persona { display:flex; flex-direction:column; }
    .opcion-persona small { font-size:var(--t-xs); color:var(--tinta-suave); }
    .ayuda.alerta { color:var(--aviso); }

    .sin-stock { color:var(--alerta); }
    .tope { display:block; font-size:var(--t-xs); color:var(--alerta);
            text-align:right; margin-top:.125rem; }
    .fila-acciones { text-align:right; }
  `],
})
export class SalidaFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly servicio = inject(SalidaService);
  private readonly catalogo = inject(CatalogoService);
  private readonly catalogoPersonas = inject(SolicitanteService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  readonly id = input<string | undefined>();

  readonly salida = signal<Salida | null>(null);
  readonly detalles = signal<SalidaDetalle[]>([]);
  readonly sugerencias = signal<ProductoBuscado[]>([]);
  readonly guardando = signal(false);

  readonly unidades = signal<UnidadSolicitante[]>([]);
  readonly personas = signal<Solicitante[]>([]);

  /** La unidad elegida acota quién puede figurar como solicitante. */
  private readonly unidadElegida = signal<number | null>(null);

  readonly personasDeLaUnidad = computed(() => {
    const unidad = this.unidadElegida();
    return unidad ? this.personas().filter(p => p.unidad_solicitante_id === unidad) : [];
  });

  /** Quien retira puede ser de otra unidad: a veces va un mensajero. */
  readonly quienesRetiran = computed(() =>
    this.personas().filter(p => p.autorizado_retirar));

  readonly hoy = new Date();
  productoElegido: ProductoBuscado | null = null;

  readonly esNueva = computed(() => !this.id());

  readonly formulario = this.fb.nonNullable.group({
    fecha: [new Date(), Validators.required],
    unidad_solicitante_id: [null as number | null, Validators.required],
    solicitante_id: [null as number | null, Validators.required],
    recibido_por_id: [null as number | null, Validators.required],
    centro_costo: [''],
    destino: [''],
    motivo: [''],
  });

  readonly errores = new ErroresFormulario(this.formulario, ETIQUETAS);

  ngOnInit(): void {
    // La unidad acota el desplegable de solicitante: hay que reaccionar al
    // cambio, y limpiar la persona si ya no pertenece a la unidad nueva.
    this.formulario.controls.unidad_solicitante_id.valueChanges.subscribe(unidad => {
      this.unidadElegida.set(unidad);

      const elegido = this.formulario.value.solicitante_id;
      const sigueValiendo = this.personas()
        .some(p => p.id === elegido && p.unidad_solicitante_id === unidad);

      if (elegido && !sigueValiendo) {
        this.formulario.patchValue({ solicitante_id: null }, { emitEvent: false });
      }
    });

    const id = this.id();

    forkJoin({
      unidades: this.catalogoPersonas.unidades(true),
      personas: this.catalogoPersonas.listar({ solo_activos: true }),
    }).subscribe(({ unidades, personas }) => {
      this.unidades.set(unidades.data);
      this.personas.set(personas.data);

      if (id) this.cargarSalida(Number(id));
    });

    if (!id) return;
  }

  private cargarSalida(id: number): void {
    this.servicio.obtener(id).subscribe(res => {
      const salida = res.data;
      this.salida.set(salida);

      if (!salida.editable) {
        this.mensajes.add({
          severity: 'warn',
          summary: 'Solo lectura',
          detail: 'Esta salida ya no está en borrador.',
        });
        this.router.navigate(['/salidas', id]);
        return;
      }

      this.unidadElegida.set(salida.unidad_solicitante_id ?? null);

      this.formulario.patchValue({
        fecha: new Date(salida.fecha + 'T00:00:00'),
        unidad_solicitante_id: salida.unidad_solicitante_id ?? null,
        solicitante_id: salida.solicitante_id ?? null,
        recibido_por_id: salida.recibido_por_id ?? null,
        centro_costo: salida.centro_costo ?? '',
        destino: salida.destino ?? '',
        motivo: salida.motivo ?? '',
      });

      // Al editar hay que recuperar el saldo de cada línea: la respuesta del
      // documento no lo trae, porque no es un dato del documento sino del
      // almacén en este momento.
      this.detalles.set(salida.detalles ?? []);
      this.recuperarSaldos();
    });
  }

  private recuperarSaldos(): void {
    this.detalles().forEach(linea => {
      if (!linea.codigo) return;

      this.catalogo.buscarProductos(linea.codigo).subscribe(res => {
        const encontrado = res.data.find(p => p.id === linea.producto_id);
        if (!encontrado) return;

        this.detalles.update(lista => lista.map(l => l.producto_id === linea.producto_id
          ? {
              ...l,
              // Lo ya reservado por este borrador sigue disponible para él.
              disponible: encontrado.disponible,
              permite_decimales: encontrado.permite_decimales,
            }
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
      observacion: null,
      disponible: producto.disponible,
      permite_decimales: producto.permite_decimales,
    }]);

    this.productoElegido = null;
  }

  excede(linea: SalidaDetalle): boolean {
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

    // El servidor lo vuelve a verificar al guardar y al confirmar.
    this.detalles()
      .filter(d => this.excede(d))
      .forEach(d => extras.push(
        `Solo hay ${d.disponible} de ${d.producto}; no se puede entregar ${d.cantidad}.`,
      ));

    if (!this.errores.validar(extras)) return;

    this.guardando.set(true);
    const v = this.formulario.getRawValue();

    const carga: SalidaPayload = {
      fecha: this.aIso(v.fecha),
      unidad_solicitante_id: v.unidad_solicitante_id!,
      solicitante_id: v.solicitante_id!,
      recibido_por_id: v.recibido_por_id!,
      centro_costo: v.centro_costo || null,
      destino: v.destino || null,
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
      next: (res) => {
        this.mensajes.add({
          severity: 'success',
          summary: id ? 'Salida actualizada' : 'Salida registrada',
          detail: 'Imprima la nota, hágala firmar y después confírmela.',
        });

        const destino = id ?? (res as Salida)?.id;
        this.router.navigate(destino ? ['/salidas', destino] : ['/salidas']);
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
    this.router.navigate(['/salidas']);
  }
}
