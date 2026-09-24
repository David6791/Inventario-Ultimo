import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { PanelModule } from 'primeng/panel';
import { Observable, forkJoin, of } from 'rxjs';
import {
  Categoria, Producto, ProductoPayload, UnidadMedida,
} from '../../core/models/catalogo.models';
import { CatalogoService } from '../../core/services/catalogo.service';
import { ErroresFormulario } from '../../shared/formularios/errores-formulario';
import { ResumenErroresComponent } from '../../shared/formularios/resumen-errores.component';

const ETIQUETAS: Record<string, string> = {
  codigo: 'Código',
  nombre: 'Nombre',
  descripcion: 'Descripción',
  categoria_id: 'Categoría',
  unidad_medida_id: 'Unidad de medida',
  partida_presupuestaria: 'Partida presupuestaria',
  codigo_barras: 'Código de barras',
  stock_minimo: 'Stock mínimo',
  stock_maximo: 'Stock máximo',
};

@Component({
  selector: 'app-producto-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule, ButtonModule, InputTextModule,
    InputTextareaModule, InputNumberModule, DropdownModule, CheckboxModule,
    PanelModule, ResumenErroresComponent,
  ],
  template: `
    <form [formGroup]="formulario" (ngSubmit)="guardar()">

      <header class="pagina">
        <div>
          <h1>{{ esNuevo() ? 'Registrar producto' : producto()?.nombre }}</h1>
          <p>El código identifica al producto en todo el sistema y no conviene
             cambiarlo una vez que tenga movimientos.</p>
        </div>
        <div class="acciones">
          <button pButton type="button" label="Cancelar" severity="secondary" text
                  (click)="volver()"></button>
          <button pButton type="submit" icon="pi pi-check"
                  [label]="esNuevo() ? 'Registrar producto' : 'Guardar cambios'"
                  [loading]="guardando()"></button>
        </div>
      </header>

      <app-resumen-errores [problemas]="errores.resumen()" />

      <p-panel header="Identificación">
        <div class="rejilla">
          <div class="campo">
            <label for="codigo">Código</label>
            <input pInputText id="codigo" formControlName="codigo" class="codigo"
                   placeholder="ESCR-0001" />
            @if (errores.de('codigo')) { <small class="error">{{ errores.de('codigo') }}</small> }
            @else { <small class="ayuda">Letras, números, guiones y puntos.</small> }
          </div>

          <div class="campo ancho-doble">
            <label for="nombre">Nombre</label>
            <input pInputText id="nombre" formControlName="nombre"
                   placeholder="Papel bond tamaño carta 75 g" />
            @if (errores.de('nombre')) { <small class="error">{{ errores.de('nombre') }}</small> }
          </div>

          <div class="campo ancho-total">
            <label for="descripcion">Descripción</label>
            <textarea pInputTextarea id="descripcion" formControlName="descripcion" rows="2"
                      placeholder="Detalles que ayuden a distinguirlo de productos parecidos"></textarea>
          </div>
        </div>
      </p-panel>

      <p-panel header="Clasificación">
        <div class="rejilla">
          <div class="campo">
            <label for="categoria">Categoría</label>
            <p-dropdown inputId="categoria" [options]="categorias()" formControlName="categoria_id"
                        optionLabel="nombre" optionValue="id" [filter]="true"
                        placeholder="Elija una categoría" styleClass="ancho" />
            @if (errores.de('categoria_id')) { <small class="error">{{ errores.de('categoria_id') }}</small> }
          </div>

          <div class="campo">
            <label for="unidad">Unidad de medida</label>
            <p-dropdown inputId="unidad" [options]="unidades()" formControlName="unidad_medida_id"
                        optionLabel="nombre" optionValue="id" [filter]="true"
                        placeholder="Elija una unidad" styleClass="ancho" />
            @if (errores.de('unidad_medida_id')) { <small class="error">{{ errores.de('unidad_medida_id') }}</small> }
            @else if (unidadElegida()) {
              <small class="ayuda">
                {{ unidadElegida()!.permite_decimales
                   ? 'Admite cantidades con decimales.'
                   : 'Solo admite cantidades enteras.' }}
              </small>
            }
          </div>

          <div class="campo">
            <label for="partida">Partida presupuestaria</label>
            <input pInputText id="partida" formControlName="partida_presupuestaria"
                   class="codigo" placeholder="34200" />
            <small class="ayuda">Opcional. Se usa en los reportes de rendición.</small>
          </div>

          <div class="campo">
            <label for="barras">Código de barras</label>
            <input pInputText id="barras" formControlName="codigo_barras" class="codigo" />
            @if (errores.de('codigo_barras')) { <small class="error">{{ errores.de('codigo_barras') }}</small> }
          </div>
        </div>
      </p-panel>

      <p-panel header="Control de existencias">
        <div class="rejilla">
          <div class="campo">
            <label for="minimo">Stock mínimo</label>
            <p-inputNumber inputId="minimo" formControlName="stock_minimo" [min]="0"
                           [maxFractionDigits]="decimales()" styleClass="ancho" />
            @if (errores.de('stock_minimo')) { <small class="error">{{ errores.de('stock_minimo') }}</small> }
            @else { <small class="ayuda">Por debajo de esta cantidad el producto se marca en la lista. Use 0 si no controla mínimos.</small> }
          </div>

          <div class="campo">
            <label for="maximo">Stock máximo</label>
            <p-inputNumber inputId="maximo" formControlName="stock_maximo" [min]="0"
                           [maxFractionDigits]="decimales()" styleClass="ancho" />
            @if (errores.de('stock_maximo')) { <small class="error">{{ errores.de('stock_maximo') }}</small> }
            @else { <small class="ayuda">Opcional. Sirve para no sobrecomprar.</small> }
          </div>
        </div>

        <div class="opciones">
          <label class="opcion">
            <p-checkbox formControlName="controla_lote" [binary]="true" inputId="lote" />
            <span>
              <span class="titulo">Controlar número de lote</span>
              <span class="detalle">Al registrar un ingreso se pedirá el lote de cada partida.</span>
            </span>
          </label>

          <label class="opcion">
            <p-checkbox formControlName="controla_vencimiento" [binary]="true" inputId="vence" />
            <span>
              <span class="titulo">Controlar fecha de vencimiento</span>
              <span class="detalle">Habilita el reporte de productos próximos a vencer.</span>
            </span>
          </label>

          <label class="opcion">
            <p-checkbox formControlName="activo" [binary]="true" inputId="activo" />
            <span>
              <span class="titulo">Producto activo</span>
              <span class="detalle">Los inactivos no aparecen al registrar movimientos.</span>
            </span>
          </label>
        </div>
      </p-panel>
    </form>
  `,
  styles: [`
    :host ::ng-deep p-panel { display:block; margin-bottom:1rem; }
    :host ::ng-deep .ancho, :host ::ng-deep .ancho .p-inputnumber-input { width:100%; }
    .ancho-doble { grid-column:span 2; }
    .ancho-total { grid-column:1 / -1; }

    .opciones { display:flex; flex-direction:column; gap:.875rem; margin-top:1.25rem;
                padding-top:1rem; border-top:1px solid var(--linea-tenue); }
    .opcion { display:flex; align-items:flex-start; gap:.625rem; cursor:pointer; }
    .opcion > span { display:flex; flex-direction:column; gap:.0625rem; }
    .opcion .titulo { font-size:var(--t-sm); font-weight:500; }
    .opcion .detalle { font-size:var(--t-xs); color:var(--tinta-suave); }

    @media (max-width: 50rem) { .ancho-doble { grid-column:auto; } }
  `],
})
export class ProductoFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly servicio = inject(CatalogoService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  readonly id = input<string | undefined>();

  readonly producto = signal<Producto | null>(null);
  readonly categorias = signal<Categoria[]>([]);
  readonly unidades = signal<UnidadMedida[]>([]);
  readonly guardando = signal(false);

  readonly esNuevo = computed(() => !this.id());

  readonly formulario = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    nombre: ['', [Validators.required, Validators.maxLength(200)]],
    descripcion: [''],
    categoria_id: [null as number | null, Validators.required],
    unidad_medida_id: [null as number | null, Validators.required],
    partida_presupuestaria: [''],
    codigo_barras: [''],
    stock_minimo: [0, [Validators.required, Validators.min(0)]],
    stock_maximo: [null as number | null],
    controla_lote: [false],
    controla_vencimiento: [false],
    activo: [true],
  });

  readonly errores = new ErroresFormulario(this.formulario, ETIQUETAS);

  /** La unidad decide si el campo de cantidad admite decimales. */
  readonly unidadElegida = signal<UnidadMedida | null>(null);
  readonly decimales = computed(() => this.unidadElegida()?.permite_decimales ? 4 : 0);

  ngOnInit(): void {
    const id = this.id();

    // forkJoin y no tres subscribe: patchValue debe correr cuando categorías y
    // unidades ya están, o los desplegables descartan los identificadores.
    forkJoin({
      categorias: this.servicio.categorias(true),
      unidades: this.servicio.unidades(true),
      producto: id ? this.servicio.producto(Number(id)) : of(null),
    }).subscribe(({ categorias, unidades, producto }) => {
      this.categorias.set(categorias.data);
      this.unidades.set(unidades.data);

      if (producto) {
        this.rellenar(producto.data);
      }
    });

    this.formulario.controls.unidad_medida_id.valueChanges
      .subscribe(valor => this.sincronizarUnidad(valor));
  }

  /** Campo por campo, no patchValue del objeto entero: la respuesta trae
   *  `categoria` y `unidad` planos que no son controles del formulario. */
  private rellenar(producto: Producto): void {
    this.producto.set(producto);

    this.formulario.patchValue({
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      categoria_id: producto.categoria_id,
      unidad_medida_id: producto.unidad_medida_id,
      partida_presupuestaria: producto.partida_presupuestaria ?? '',
      codigo_barras: producto.codigo_barras ?? '',
      stock_minimo: producto.stock_minimo,
      stock_maximo: producto.stock_maximo,
      controla_lote: producto.controla_lote,
      controla_vencimiento: producto.controla_vencimiento,
      activo: producto.activo,
    });

    this.sincronizarUnidad(producto.unidad_medida_id);
  }

  private sincronizarUnidad(id: number | null): void {
    this.unidadElegida.set(this.unidades().find(u => u.id === id) ?? null);
  }

  guardar(): void {
    const maximo = this.formulario.getRawValue().stock_maximo;
    const minimo = this.formulario.getRawValue().stock_minimo;

    const extras = maximo !== null && maximo < minimo
      ? ['El stock máximo no puede ser menor que el mínimo.']
      : [];

    if (!this.errores.validar(extras)) {
      return;
    }

    this.guardando.set(true);
    const datos = this.formulario.getRawValue();
    const id = this.id();

    // Tipado explícito: crear() y actualizar() devuelven formas distintas y el
    // subscribe de la unión no es invocable.
    const carga: ProductoPayload = {
      ...datos,
      descripcion: datos.descripcion || null,
      partida_presupuestaria: datos.partida_presupuestaria || null,
      codigo_barras: datos.codigo_barras || null,
    };

    const peticion: Observable<unknown> = id
      ? this.servicio.actualizarProducto(Number(id), carga)
      : this.servicio.crearProducto(carga);

    peticion.subscribe({
      next: () => {
        this.mensajes.add({
          severity: 'success',
          summary: id ? 'Producto actualizado' : 'Producto registrado',
          detail: `${datos.codigo} — ${datos.nombre}`,
        });
        this.router.navigate(['/productos']);
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errores.desdeServidor(error);
      },
    });
  }

  volver(): void {
    this.router.navigate(['/productos']);
  }
}
