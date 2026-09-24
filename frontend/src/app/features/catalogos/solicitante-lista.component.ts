import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TooltipModule } from 'primeng/tooltip';
import { Observable, forkJoin } from 'rxjs';
import { Solicitante, UnidadSolicitante } from '../../core/models/solicitante.models';
import { SolicitanteService } from '../../core/services/solicitante.service';
import { ErroresFormulario } from '../../shared/formularios/errores-formulario';
import { ResumenErroresComponent } from '../../shared/formularios/resumen-errores.component';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

/**
 * Unidades y personas que solicitan material.
 *
 * No son usuarios del sistema: la mayoría nunca entra a la aplicación. Están
 * acá para poder elegirlas al registrar una salida, en vez de escribir el
 * nombre a mano cada vez — que es como "Área Técnica" y "Area Tecnica" terminan
 * contando como dos unidades distintas en los reportes.
 */
@Component({
  selector: 'app-solicitante-lista',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule, TableModule, TabViewModule, ButtonModule,
    InputTextModule, CheckboxModule, DropdownModule, DialogModule, TooltipModule,
    ResumenErroresComponent, TienePermisoDirective,
  ],
  template: `
    <header class="pagina">
      <div>
        <h1>Unidades y solicitantes</h1>
        <p>Quiénes piden y quiénes retiran material. Registrarlos acá evita
           escribir el nombre a mano en cada salida.</p>
      </div>
    </header>

    <p-tabView>
      <!-- ------------------------------------------------- Solicitantes -->
      <p-tabPanel header="Solicitantes">
        <div class="barra">
          <div class="izquierda">
            <span class="conteo">{{ solicitantesFiltrados().length }} personas</span>
            <p-dropdown [options]="unidades()" [(ngModel)]="unidadFiltro"
                        optionLabel="nombre" optionValue="id"
                        placeholder="Todas las unidades" [showClear]="true"
                        [filter]="true" styleClass="filtro-unidad" />
          </div>
          <button pButton icon="pi pi-plus" label="Nuevo solicitante" size="small"
                  *appTienePermiso="'solicitantes.gestionar'"
                  [disabled]="!unidades().length"
                  [pTooltip]="!unidades().length ? 'Primero cree al menos una unidad' : ''"
                  (click)="abrirSolicitante()"></button>
        </div>

        <p-table [value]="solicitantesFiltrados()" [loading]="cargando()" dataKey="id"
                 styleClass="p-datatable-sm">
          <ng-template pTemplate="header">
            <tr>
              <th>Nombre</th>
              <th style="width:8rem">Carnet</th>
              <th style="width:14rem">Cargo</th>
              <th style="width:16rem">Unidad</th>
              <th style="width:7rem" class="centrado">Retira</th>
              <th style="width:5rem"></th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-s>
            <tr class="marca" [class.marca-inactivo]="!s.activo" [class.atenuada]="!s.activo">
              <td class="nombre">
                {{ s.nombre }}
                @if (!s.activo) { <span class="baja">inactivo</span> }
              </td>
              <td><span class="codigo">{{ s.ci || '—' }}</span></td>
              <td class="tenue">{{ s.cargo || '—' }}</td>
              <td class="tenue">{{ s.unidad }}</td>
              <td class="centrado">
                @if (s.autorizado_retirar) {
                  <i class="pi pi-check si" pTooltip="Puede retirar material del almacén"></i>
                } @else {
                  <span class="no">—</span>
                }
              </td>
              <td class="fila-acciones">
                <button pButton icon="pi pi-pencil" text rounded
                        *appTienePermiso="'solicitantes.gestionar'"
                        pTooltip="Editar" (click)="abrirSolicitante(s)"></button>
                <button pButton icon="pi pi-trash" text rounded severity="danger"
                        *appTienePermiso="'solicitantes.gestionar'"
                        pTooltip="Eliminar" (click)="eliminarSolicitante(s)"></button>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr><td colspan="6">
              <div class="vacio">
                <i class="pi pi-id-card"></i>
                <p>{{ unidades().length
                    ? 'No hay solicitantes registrados todavía.'
                    : 'Primero cree una unidad en la pestaña de al lado; después podrá registrar a su gente.' }}</p>
              </div>
            </td></tr>
          </ng-template>
        </p-table>
      </p-tabPanel>

      <!-- ----------------------------------------------------- Unidades -->
      <p-tabPanel header="Unidades">
        <div class="barra">
          <span class="conteo">{{ unidades().length }} unidades</span>
          <button pButton icon="pi pi-plus" label="Nueva unidad" size="small"
                  *appTienePermiso="'solicitantes.gestionar'"
                  (click)="abrirUnidad()"></button>
        </div>

        <p-table [value]="unidades()" [loading]="cargando()" dataKey="id"
                 styleClass="p-datatable-sm">
          <ng-template pTemplate="header">
            <tr>
              <th style="width:8rem">Código</th>
              <th>Nombre</th>
              <th style="width:16rem">Responsable</th>
              <th style="width:9rem">Centro de costo</th>
              <th style="width:7rem" class="cifra">Personas</th>
              <th style="width:5rem"></th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-u>
            <tr class="marca" [class.marca-inactivo]="!u.activo" [class.atenuada]="!u.activo">
              <td><span class="codigo">{{ u.codigo }}</span></td>
              <td class="nombre">{{ u.nombre }}</td>
              <td class="tenue">{{ u.responsable || '—' }}</td>
              <td><span class="codigo">{{ u.centro_costo || '—' }}</span></td>
              <td class="cifra">{{ u.solicitantes ?? 0 }}</td>
              <td class="fila-acciones">
                <button pButton icon="pi pi-pencil" text rounded
                        *appTienePermiso="'solicitantes.gestionar'"
                        pTooltip="Editar" (click)="abrirUnidad(u)"></button>
                <button pButton icon="pi pi-trash" text rounded severity="danger"
                        *appTienePermiso="'solicitantes.gestionar'"
                        [disabled]="(u.solicitantes ?? 0) > 0"
                        [pTooltip]="(u.solicitantes ?? 0) > 0
                          ? 'No se puede eliminar: tiene personas asignadas'
                          : 'Eliminar'"
                        (click)="eliminarUnidad(u)"></button>
              </td>
            </tr>
          </ng-template>

          <ng-template pTemplate="emptymessage">
            <tr><td colspan="6">
              <div class="vacio">
                <i class="pi pi-sitemap"></i>
                <p>Todavía no hay unidades. Cree la primera para poder registrar
                   solicitantes y salidas.</p>
              </div>
            </td></tr>
          </ng-template>
        </p-table>
      </p-tabPanel>
    </p-tabView>

    <!-- ---------------------------------------------- Diálogo unidad -->
    <p-dialog [header]="editandoUnidad() ? 'Editar unidad' : 'Nueva unidad'"
              [(visible)]="dialogoUnidad" [modal]="true" [draggable]="false"
              [style]="{ width: '32rem' }">
      <form [formGroup]="formUnidad" (ngSubmit)="guardarUnidad()">
        <app-resumen-errores [problemas]="erroresUnidad.resumen()" />

        <div class="campo">
          <label for="u-codigo">Código</label>
          <input pInputText id="u-codigo" formControlName="codigo" class="codigo"
                 placeholder="DAF" />
          @if (erroresUnidad.de('codigo')) {
            <small class="error">{{ erroresUnidad.de('codigo') }}</small>
          }
        </div>

        <div class="campo">
          <label for="u-nombre">Nombre</label>
          <input pInputText id="u-nombre" formControlName="nombre"
                 placeholder="Dirección Administrativa Financiera" />
          @if (erroresUnidad.de('nombre')) {
            <small class="error">{{ erroresUnidad.de('nombre') }}</small>
          }
        </div>

        <div class="campo">
          <label for="u-responsable">Responsable</label>
          <input pInputText id="u-responsable" formControlName="responsable"
                 placeholder="Quien firma por la unidad" />
        </div>

        <div class="campo">
          <label for="u-centro">Centro de costo</label>
          <input pInputText id="u-centro" formControlName="centro_costo" class="codigo" />
          <small class="ayuda">Se usa por defecto en las salidas de esta unidad.</small>
        </div>

        <label class="opcion">
          <p-checkbox formControlName="activo" [binary]="true" inputId="u-activo" />
          <span>Activa — disponible al registrar salidas</span>
        </label>

        <div class="pie">
          <button pButton type="button" label="Cancelar" severity="secondary" text
                  (click)="dialogoUnidad = false"></button>
          <button pButton type="submit" label="Guardar" [loading]="guardando()"></button>
        </div>
      </form>
    </p-dialog>

    <!-- ----------------------------------------- Diálogo solicitante -->
    <p-dialog [header]="editandoSolicitante() ? 'Editar solicitante' : 'Nuevo solicitante'"
              [(visible)]="dialogoSolicitante" [modal]="true" [draggable]="false"
              [style]="{ width: '32rem' }">
      <form [formGroup]="formSolicitante" (ngSubmit)="guardarSolicitante()">
        <app-resumen-errores [problemas]="erroresSolicitante.resumen()" />

        <div class="campo">
          <label for="s-unidad">Unidad</label>
          <p-dropdown inputId="s-unidad" [options]="unidadesActivas()"
                      formControlName="unidad_solicitante_id"
                      optionLabel="nombre" optionValue="id" [filter]="true"
                      placeholder="Elija la unidad" styleClass="ancho" appendTo="body" />
          @if (erroresSolicitante.de('unidad_solicitante_id')) {
            <small class="error">{{ erroresSolicitante.de('unidad_solicitante_id') }}</small>
          }
        </div>

        <div class="campo">
          <label for="s-nombre">Nombre completo</label>
          <input pInputText id="s-nombre" formControlName="nombre" />
          @if (erroresSolicitante.de('nombre')) {
            <small class="error">{{ erroresSolicitante.de('nombre') }}</small>
          }
        </div>

        <div class="dos">
          <div class="campo">
            <label for="s-ci">Carnet de identidad</label>
            <input pInputText id="s-ci" formControlName="ci" class="codigo" />
          </div>

          <div class="campo">
            <label for="s-telefono">Teléfono</label>
            <input pInputText id="s-telefono" formControlName="telefono" />
          </div>
        </div>

        <div class="campo">
          <label for="s-cargo">Cargo</label>
          <input pInputText id="s-cargo" formControlName="cargo" />
        </div>

        <label class="opcion">
          <p-checkbox formControlName="autorizado_retirar" [binary]="true" inputId="s-retira" />
          <span>
            Autorizado a retirar material
            <small>Solo quienes tienen esto marcado aparecen en el campo "quien recibe" de la nota de salida.</small>
          </span>
        </label>

        <label class="opcion">
          <p-checkbox formControlName="activo" [binary]="true" inputId="s-activo" />
          <span>Activo</span>
        </label>

        <div class="pie">
          <button pButton type="button" label="Cancelar" severity="secondary" text
                  (click)="dialogoSolicitante = false"></button>
          <button pButton type="submit" label="Guardar" [loading]="guardando()"></button>
        </div>
      </form>
    </p-dialog>
  `,
  styles: [`
    .barra { display:flex; justify-content:space-between; align-items:center;
             gap:1rem; margin-bottom:.75rem; }
    .barra .izquierda { display:flex; align-items:center; gap:.875rem; }
    .conteo { font-size:var(--t-sm); color:var(--tinta-suave); }
    :host ::ng-deep .filtro-unidad { min-width:16rem; }

    .nombre { font-weight:500; }
    .baja { font-size:var(--t-xs); font-weight:400; color:var(--tinta-tenue);
            margin-left:.5rem; }
    .tenue { color:var(--tinta-suave); }
    .centrado { text-align:center; }
    .si { color:var(--bien); }
    .no { color:var(--tinta-tenue); }
    .fila-acciones { text-align:right; white-space:nowrap; }

    form .campo { margin-bottom:.875rem; }
    .dos { display:grid; grid-template-columns:1fr 1fr; gap:.875rem; }
    :host ::ng-deep .ancho { width:100%; }
    .opcion { display:flex; align-items:flex-start; gap:.625rem; cursor:pointer;
              margin-bottom:.75rem; font-size:var(--t-sm); }
    .opcion span { display:flex; flex-direction:column; gap:.125rem; }
    .opcion small { font-size:var(--t-xs); color:var(--tinta-suave);
                    line-height:1.4; max-width:34ch; }

    .pie { display:flex; justify-content:flex-end; gap:.5rem; margin-top:1.25rem;
           padding-top:1rem; border-top:1px solid var(--linea-tenue); }
  `],
})
export class SolicitanteListaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly servicio = inject(SolicitanteService);
  private readonly mensajes = inject(MessageService);
  private readonly confirmar = inject(ConfirmationService);

  readonly unidades = signal<UnidadSolicitante[]>([]);
  readonly solicitantes = signal<Solicitante[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);

  readonly editandoUnidad = signal<UnidadSolicitante | null>(null);
  readonly editandoSolicitante = signal<Solicitante | null>(null);

  dialogoUnidad = false;
  dialogoSolicitante = false;

  private readonly _unidadFiltro = signal<number | null>(null);

  get unidadFiltro(): number | null { return this._unidadFiltro(); }
  set unidadFiltro(valor: number | null) { this._unidadFiltro.set(valor); }

  readonly unidadesActivas = computed(() => this.unidades().filter(u => u.activo));

  /** El filtro se aplica en memoria: son listas cortas, no vale otra consulta. */
  readonly solicitantesFiltrados = computed(() => {
    const unidad = this._unidadFiltro();
    return unidad
      ? this.solicitantes().filter(s => s.unidad_solicitante_id === unidad)
      : this.solicitantes();
  });

  readonly formUnidad = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.maxLength(20)]],
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    responsable: [''],
    centro_costo: [''],
    activo: [true],
  });

  readonly formSolicitante = this.fb.nonNullable.group({
    unidad_solicitante_id: [null as number | null, Validators.required],
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    ci: [''],
    cargo: [''],
    telefono: [''],
    autorizado_retirar: [true],
    activo: [true],
  });

  readonly erroresUnidad = new ErroresFormulario(this.formUnidad, {
    codigo: 'Código', nombre: 'Nombre',
    responsable: 'Responsable', centro_costo: 'Centro de costo',
  });

  readonly erroresSolicitante = new ErroresFormulario(this.formSolicitante, {
    unidad_solicitante_id: 'Unidad', nombre: 'Nombre',
    ci: 'Carnet', cargo: 'Cargo', telefono: 'Teléfono',
  });

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);

    forkJoin({
      unidades: this.servicio.unidades(),
      solicitantes: this.servicio.listar(),
    }).subscribe({
      next: ({ unidades, solicitantes }) => {
        this.unidades.set(unidades.data);
        this.solicitantes.set(solicitantes.data);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  // --- Unidades ----------------------------------------------------------

  abrirUnidad(unidad?: UnidadSolicitante): void {
    this.editandoUnidad.set(unidad ?? null);
    this.erroresUnidad.limpiar();

    this.formUnidad.reset({
      codigo: unidad?.codigo ?? '',
      nombre: unidad?.nombre ?? '',
      responsable: unidad?.responsable ?? '',
      centro_costo: unidad?.centro_costo ?? '',
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
          detail: datos.nombre,
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

  eliminarUnidad(unidad: UnidadSolicitante): void {
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

  // --- Solicitantes ------------------------------------------------------

  abrirSolicitante(solicitante?: Solicitante): void {
    this.editandoSolicitante.set(solicitante ?? null);
    this.erroresSolicitante.limpiar();

    this.formSolicitante.reset({
      // Al crear, precarga la unidad que está filtrando: casi siempre se dan de
      // alta varias personas de la misma unidad seguidas.
      unidad_solicitante_id: solicitante?.unidad_solicitante_id ?? this._unidadFiltro(),
      nombre: solicitante?.nombre ?? '',
      ci: solicitante?.ci ?? '',
      cargo: solicitante?.cargo ?? '',
      telefono: solicitante?.telefono ?? '',
      autorizado_retirar: solicitante?.autorizado_retirar ?? true,
      activo: solicitante?.activo ?? true,
    });

    this.dialogoSolicitante = true;
  }

  guardarSolicitante(): void {
    if (!this.erroresSolicitante.validar()) return;

    this.guardando.set(true);
    const datos = this.formSolicitante.getRawValue();
    const enEdicion = this.editandoSolicitante();

    const peticion: Observable<unknown> = enEdicion
      ? this.servicio.actualizar(enEdicion.id, datos as Partial<Solicitante>)
      : this.servicio.crear(datos as Partial<Solicitante>);

    peticion.subscribe({
      next: () => {
        this.mensajes.add({
          severity: 'success',
          summary: enEdicion ? 'Solicitante actualizado' : 'Solicitante registrado',
          detail: datos.nombre,
        });
        this.dialogoSolicitante = false;
        this.guardando.set(false);
        this.cargar();
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.erroresSolicitante.desdeServidor(error);
      },
    });
  }

  eliminarSolicitante(solicitante: Solicitante): void {
    this.confirmar.confirm({
      header: 'Eliminar solicitante',
      message: `Se eliminará a ${solicitante.nombre}. Si ya tiene salidas `
             + 'registradas, el sistema no lo permitirá: desactívelo en su lugar.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.servicio.eliminar(solicitante.id).subscribe(() => {
        this.mensajes.add({ severity: 'success', summary: 'Solicitante eliminado' });
        this.cargar();
      }),
    });
  }
}
