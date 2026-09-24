import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TooltipModule } from 'primeng/tooltip';
import { Observable, forkJoin } from 'rxjs';
import { Categoria, UnidadMedida } from '../../core/models/catalogo.models';
import { CatalogoService } from '../../core/services/catalogo.service';
import { ErroresFormulario } from '../../shared/formularios/errores-formulario';
import { ResumenErroresComponent } from '../../shared/formularios/resumen-errores.component';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

/**
 * Categorías y unidades de medida en una sola pantalla.
 *
 * Van juntas porque comparten permiso (`categorias.gestionar`), se administran
 * en el mismo momento y son listas cortas: separarlas en dos entradas de menú
 * obligaría a ir y volver al dar de alta un producto nuevo.
 */
@Component({
  selector: 'app-clasificacion',
  standalone: true,
  imports: [
    ReactiveFormsModule, TableModule, TabViewModule, ButtonModule, InputTextModule,
    CheckboxModule, DialogModule, TooltipModule, ResumenErroresComponent, TienePermisoDirective,
  ],
  template: `
    <header class="pagina">
      <div>
        <h1>Clasificación</h1>
        <p>Cómo se agrupan y se miden los productos. Son listas cortas que casi
           no cambian una vez definidas.</p>
      </div>
    </header>

    <p-tabView>
      <!-- ---------------------------------------------------- Categorías -->
      <p-tabPanel header="Categorías">
        <div class="barra">
          <span class="conteo">{{ categorias().length }} categorías</span>
          <button pButton icon="pi pi-plus" label="Nueva categoría" size="small"
                  *appTienePermiso="'categorias.gestionar'"
                  (click)="abrirCategoria()"></button>
        </div>

        <p-table [value]="categorias()" [loading]="cargando()" dataKey="id"
                 styleClass="p-datatable-sm">
          <ng-template pTemplate="header">
            <tr>
              <th style="width:8rem">Código</th>
              <th>Nombre</th>
              <th>Descripción</th>
              <th style="width:7rem" class="cifra">Productos</th>
              <th style="width:5rem"></th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-c>
            <tr class="marca" [class.marca-inactivo]="!c.activo" [class.atenuada]="!c.activo">
              <td><span class="codigo">{{ c.codigo }}</span></td>
              <td class="nombre">{{ c.nombre }}</td>
              <td class="tenue">{{ c.descripcion || '—' }}</td>
              <td class="cifra">{{ c.productos ?? 0 }}</td>
              <td class="fila-acciones">
                <button pButton icon="pi pi-pencil" text rounded
                        *appTienePermiso="'categorias.gestionar'"
                        pTooltip="Editar" (click)="abrirCategoria(c)"></button>
                <button pButton icon="pi pi-trash" text rounded severity="danger"
                        *appTienePermiso="'categorias.gestionar'"
                        [disabled]="(c.productos ?? 0) > 0"
                        [pTooltip]="(c.productos ?? 0) > 0
                          ? 'No se puede eliminar: tiene productos. Desactívela en su lugar.'
                          : 'Eliminar'"
                        (click)="eliminarCategoria(c)"></button>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr><td colspan="5">
              <div class="vacio">
                <i class="pi pi-tags"></i>
                <p>Todavía no hay categorías. Cree la primera para poder registrar productos.</p>
                <button pButton icon="pi pi-plus" label="Nueva categoría" size="small"
                        *appTienePermiso="'categorias.gestionar'"
                        (click)="abrirCategoria()"></button>
              </div>
            </td></tr>
          </ng-template>
        </p-table>
      </p-tabPanel>

      <!-- ---------------------------------------------- Unidades de medida -->
      <p-tabPanel header="Unidades de medida">
        <div class="barra">
          <span class="conteo">{{ unidades().length }} unidades</span>
          <button pButton icon="pi pi-plus" label="Nueva unidad" size="small"
                  *appTienePermiso="'categorias.gestionar'"
                  (click)="abrirUnidad()"></button>
        </div>

        <p-table [value]="unidades()" [loading]="cargando()" dataKey="id"
                 styleClass="p-datatable-sm">
          <ng-template pTemplate="header">
            <tr>
              <th style="width:8rem">Código</th>
              <th>Nombre</th>
              <th style="width:12rem">Cantidades</th>
              <th style="width:7rem" class="cifra">Productos</th>
              <th style="width:5rem"></th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-u>
            <tr class="marca" [class.marca-inactivo]="!u.activo" [class.atenuada]="!u.activo">
              <td><span class="codigo">{{ u.codigo }}</span></td>
              <td class="nombre">{{ u.nombre }}</td>
              <td class="tenue">{{ u.permite_decimales ? 'Admite decimales' : 'Solo enteros' }}</td>
              <td class="cifra">{{ u.productos ?? 0 }}</td>
              <td class="fila-acciones">
                <button pButton icon="pi pi-pencil" text rounded
                        *appTienePermiso="'categorias.gestionar'"
                        pTooltip="Editar" (click)="abrirUnidad(u)"></button>
                <button pButton icon="pi pi-trash" text rounded severity="danger"
                        *appTienePermiso="'categorias.gestionar'"
                        [disabled]="(u.productos ?? 0) > 0"
                        [pTooltip]="(u.productos ?? 0) > 0
                          ? 'No se puede eliminar: hay productos que la usan.'
                          : 'Eliminar'"
                        (click)="eliminarUnidad(u)"></button>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr><td colspan="5">
              <div class="vacio">
                <i class="pi pi-sliders-h"></i>
                <p>Todavía no hay unidades de medida. Cree al menos una, por
                   ejemplo Unidad o Kilogramo.</p>
              </div>
            </td></tr>
          </ng-template>
        </p-table>
      </p-tabPanel>
    </p-tabView>

    <!-- ------------------------------------------------ Diálogo categoría -->
    <p-dialog [header]="editandoCategoria() ? 'Editar categoría' : 'Nueva categoría'"
              [(visible)]="dialogoCategoria" [modal]="true" [draggable]="false"
              [style]="{ width: '30rem' }">
      <form [formGroup]="formCategoria" (ngSubmit)="guardarCategoria()">
        <app-resumen-errores [problemas]="erroresCategoria.resumen()" />

        <div class="campo">
          <label for="cat-codigo">Código</label>
          <input pInputText id="cat-codigo" formControlName="codigo" class="codigo"
                 placeholder="ESCR" />
          @if (erroresCategoria.de('codigo')) {
            <small class="error">{{ erroresCategoria.de('codigo') }}</small>
          } @else {
            <small class="ayuda">Abreviatura corta que aparece en los códigos de producto.</small>
          }
        </div>

        <div class="campo">
          <label for="cat-nombre">Nombre</label>
          <input pInputText id="cat-nombre" formControlName="nombre"
                 placeholder="Material de escritorio" />
          @if (erroresCategoria.de('nombre')) {
            <small class="error">{{ erroresCategoria.de('nombre') }}</small>
          }
        </div>

        <div class="campo">
          <label for="cat-desc">Descripción</label>
          <input pInputText id="cat-desc" formControlName="descripcion" />
        </div>

        <label class="opcion">
          <p-checkbox formControlName="activo" [binary]="true" inputId="cat-activo" />
          <span>Activa — disponible al registrar productos</span>
        </label>

        <div class="pie">
          <button pButton type="button" label="Cancelar" severity="secondary" text
                  (click)="dialogoCategoria = false"></button>
          <button pButton type="submit" label="Guardar" [loading]="guardando()"></button>
        </div>
      </form>
    </p-dialog>

    <!-- --------------------------------------------------- Diálogo unidad -->
    <p-dialog [header]="editandoUnidad() ? 'Editar unidad' : 'Nueva unidad de medida'"
              [(visible)]="dialogoUnidad" [modal]="true" [draggable]="false"
              [style]="{ width: '30rem' }">
      <form [formGroup]="formUnidad" (ngSubmit)="guardarUnidad()">
        <app-resumen-errores [problemas]="erroresUnidad.resumen()" />

        <div class="campo">
          <label for="uni-codigo">Código</label>
          <input pInputText id="uni-codigo" formControlName="codigo" class="codigo"
                 placeholder="KG" />
          @if (erroresUnidad.de('codigo')) {
            <small class="error">{{ erroresUnidad.de('codigo') }}</small>
          }
        </div>

        <div class="campo">
          <label for="uni-nombre">Nombre</label>
          <input pInputText id="uni-nombre" formControlName="nombre" placeholder="Kilogramo" />
          @if (erroresUnidad.de('nombre')) {
            <small class="error">{{ erroresUnidad.de('nombre') }}</small>
          }
        </div>

        <label class="opcion">
          <p-checkbox formControlName="permite_decimales" [binary]="true" inputId="uni-dec" />
          <span>
            Admite cantidades con decimales
            <small>Por ejemplo 2,5 kg. Déjelo sin marcar para unidades que solo van enteras.</small>
          </span>
        </label>

        <label class="opcion">
          <p-checkbox formControlName="activo" [binary]="true" inputId="uni-activo" />
          <span>Activa — disponible al registrar productos</span>
        </label>

        <div class="pie">
          <button pButton type="button" label="Cancelar" severity="secondary" text
                  (click)="dialogoUnidad = false"></button>
          <button pButton type="submit" label="Guardar" [loading]="guardando()"></button>
        </div>
      </form>
    </p-dialog>
  `,
  styles: [`
    .barra { display:flex; justify-content:space-between; align-items:center;
             margin-bottom:.75rem; }
    .conteo { font-size:var(--t-sm); color:var(--tinta-suave); }
    .nombre { font-weight:500; }
    .tenue { color:var(--tinta-suave); }
    .fila-acciones { text-align:right; white-space:nowrap; }

    form .campo { margin-bottom:.875rem; }
    .opcion { display:flex; align-items:flex-start; gap:.625rem; cursor:pointer;
              margin-bottom:.75rem; font-size:var(--t-sm); }
    .opcion span { display:flex; flex-direction:column; gap:.125rem; }
    .opcion small { font-size:var(--t-xs); color:var(--tinta-suave); }

    .pie { display:flex; justify-content:flex-end; gap:.5rem; margin-top:1.25rem;
           padding-top:1rem; border-top:1px solid var(--linea-tenue); }
  `],
})
export class ClasificacionComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly servicio = inject(CatalogoService);
  private readonly mensajes = inject(MessageService);
  private readonly confirmar = inject(ConfirmationService);

  readonly categorias = signal<Categoria[]>([]);
  readonly unidades = signal<UnidadMedida[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);

  readonly editandoCategoria = signal<Categoria | null>(null);
  readonly editandoUnidad = signal<UnidadMedida | null>(null);

  dialogoCategoria = false;
  dialogoUnidad = false;

  readonly formCategoria = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.maxLength(20)]],
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    descripcion: [''],
    activo: [true],
  });

  readonly formUnidad = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.maxLength(10)]],
    nombre: ['', [Validators.required, Validators.maxLength(60)]],
    permite_decimales: [false],
    activo: [true],
  });

  readonly erroresCategoria = new ErroresFormulario(this.formCategoria, {
    codigo: 'Código', nombre: 'Nombre', descripcion: 'Descripción',
  });

  readonly erroresUnidad = new ErroresFormulario(this.formUnidad, {
    codigo: 'Código', nombre: 'Nombre',
  });

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);

    forkJoin({
      categorias: this.servicio.categorias(),
      unidades: this.servicio.unidades(),
    }).subscribe({
      next: ({ categorias, unidades }) => {
        this.categorias.set(categorias.data);
        this.unidades.set(unidades.data);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  // --- Categorías --------------------------------------------------------

  abrirCategoria(categoria?: Categoria): void {
    this.editandoCategoria.set(categoria ?? null);
    this.erroresCategoria.limpiar();

    this.formCategoria.reset({
      codigo: categoria?.codigo ?? '',
      nombre: categoria?.nombre ?? '',
      descripcion: categoria?.descripcion ?? '',
      activo: categoria?.activo ?? true,
    });

    this.dialogoCategoria = true;
  }

  guardarCategoria(): void {
    if (!this.erroresCategoria.validar()) return;

    this.guardando.set(true);
    const datos = this.formCategoria.getRawValue();
    const enEdicion = this.editandoCategoria();

    const peticion: Observable<unknown> = enEdicion
      ? this.servicio.actualizarCategoria(enEdicion.id, datos)
      : this.servicio.crearCategoria(datos);

    peticion.subscribe({
      next: () => {
        this.mensajes.add({
          severity: 'success',
          summary: enEdicion ? 'Categoría actualizada' : 'Categoría creada',
          detail: datos.nombre,
        });
        this.dialogoCategoria = false;
        this.guardando.set(false);
        this.cargar();
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.erroresCategoria.desdeServidor(error);
      },
    });
  }

  eliminarCategoria(categoria: Categoria): void {
    this.confirmar.confirm({
      header: 'Eliminar categoría',
      message: `Se eliminará "${categoria.nombre}". Esta acción no se puede deshacer.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.servicio.eliminarCategoria(categoria.id).subscribe(() => {
        this.mensajes.add({ severity: 'success', summary: 'Categoría eliminada' });
        this.cargar();
      }),
    });
  }

  // --- Unidades ----------------------------------------------------------

  abrirUnidad(unidad?: UnidadMedida): void {
    this.editandoUnidad.set(unidad ?? null);
    this.erroresUnidad.limpiar();

    this.formUnidad.reset({
      codigo: unidad?.codigo ?? '',
      nombre: unidad?.nombre ?? '',
      permite_decimales: unidad?.permite_decimales ?? false,
      activo: unidad?.activo ?? true,
    });

    this.dialogoUnidad = true;
  }

  guardarUnidad(): void {
    if (!this.erroresUnidad.validar()) return;

    this.guardando.set(true);
    const datos = this.formUnidad.getRawValue();
    const enEdicion = this.editandoUnidad();

    const peticion: Observable<unknown> = enEdicion
      ? this.servicio.actualizarUnidad(enEdicion.id, datos)
      : this.servicio.crearUnidad(datos);

    peticion.subscribe({
      next: () => {
        this.mensajes.add({
          severity: 'success',
          summary: enEdicion ? 'Unidad actualizada' : 'Unidad creada',
          detail: `${datos.codigo} — ${datos.nombre}`,
        });
        this.dialogoUnidad = false;
        this.guardando.set(false);
        this.cargar();
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.erroresUnidad.desdeServidor(error);
      },
    });
  }

  eliminarUnidad(unidad: UnidadMedida): void {
    this.confirmar.confirm({
      header: 'Eliminar unidad',
      message: `Se eliminará "${unidad.nombre}". Esta acción no se puede deshacer.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.servicio.eliminarUnidad(unidad.id).subscribe(() => {
        this.mensajes.add({ severity: 'success', summary: 'Unidad eliminada' });
        this.cargar();
      }),
    });
  }
}
