import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { Observable } from 'rxjs';
import { AlmacenCatalogo } from '../../core/models/catalogo.models';
import { CatalogoService } from '../../core/services/catalogo.service';
import { ErroresFormulario } from '../../shared/formularios/errores-formulario';
import { ResumenErroresComponent } from '../../shared/formularios/resumen-errores.component';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';

@Component({
  selector: 'app-almacen-lista',
  standalone: true,
  imports: [
    ReactiveFormsModule, TableModule, ButtonModule, InputTextModule, CheckboxModule,
    DialogModule, TooltipModule, ResumenErroresComponent, TienePermisoDirective,
  ],
  template: `
    <header class="pagina">
      <div>
        <h1>Almacenes</h1>
        <p>Cada almacén lleva sus propias existencias y su propio kardex. Quién
           accede a cuál se define en la ficha de cada usuario.</p>
      </div>
      <div class="acciones">
        <button pButton icon="pi pi-plus" label="Nuevo almacén"
                *appTienePermiso="'almacenes.gestionar'"
                (click)="abrir()"></button>
      </div>
    </header>

    <p-table [value]="almacenes()" [loading]="cargando()" dataKey="id"
             styleClass="p-datatable-sm">
      <ng-template pTemplate="header">
        <tr>
          <th style="width:9rem">Código</th>
          <th>Nombre</th>
          <th>Ubicación</th>
          <th style="width:14rem">Responsable</th>
          <th style="width:7rem" class="cifra">Usuarios</th>
          <th style="width:5rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-a>
        <tr class="marca" [class.marca-inactivo]="!a.activo" [class.atenuada]="!a.activo">
          <td><span class="codigo">{{ a.codigo }}</span></td>
          <td class="nombre">
            {{ a.nombre }}
            @if (!a.activo) { <span class="baja">desactivado</span> }
          </td>
          <td class="tenue">{{ a.ubicacion || '—' }}</td>
          <td class="tenue">{{ a.responsable || '—' }}</td>
          <td class="cifra">{{ a.usuarios ?? 0 }}</td>
          <td class="fila-acciones">
            <button pButton icon="pi pi-pencil" text rounded
                    *appTienePermiso="'almacenes.gestionar'"
                    pTooltip="Editar" (click)="abrir(a)"></button>
            <button pButton text rounded
                    *appTienePermiso="'almacenes.gestionar'"
                    [icon]="a.activo ? 'pi pi-ban' : 'pi pi-check-circle'"
                    [severity]="a.activo ? 'danger' : 'success'"
                    [pTooltip]="a.activo ? 'Desactivar' : 'Reactivar'"
                    (click)="cambiarEstado(a)"></button>
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="6">
          <div class="vacio">
            <i class="pi pi-building"></i>
            <p>Todavía no hay almacenes. Cree el primero para poder registrar
               existencias y asignar usuarios.</p>
            <button pButton icon="pi pi-plus" label="Nuevo almacén" size="small"
                    *appTienePermiso="'almacenes.gestionar'"
                    (click)="abrir()"></button>
          </div>
        </td></tr>
      </ng-template>
    </p-table>

    <p-dialog [header]="editando() ? 'Editar almacén' : 'Nuevo almacén'"
              [(visible)]="dialogo" [modal]="true" [draggable]="false"
              [style]="{ width: '32rem' }">
      <form [formGroup]="formulario" (ngSubmit)="guardar()">
        <app-resumen-errores [problemas]="errores.resumen()" />

        <div class="campo">
          <label for="codigo">Código</label>
          <input pInputText id="codigo" formControlName="codigo" class="codigo"
                 placeholder="ALM-CEN" />
          @if (errores.de('codigo')) {
            <small class="error">{{ errores.de('codigo') }}</small>
          } @else {
            <small class="ayuda">Aparece en los números de documento de este almacén.</small>
          }
        </div>

        <div class="campo">
          <label for="nombre">Nombre</label>
          <input pInputText id="nombre" formControlName="nombre"
                 placeholder="Almacén Central" />
          @if (errores.de('nombre')) { <small class="error">{{ errores.de('nombre') }}</small> }
        </div>

        <div class="campo">
          <label for="ubicacion">Ubicación</label>
          <input pInputText id="ubicacion" formControlName="ubicacion"
                 placeholder="Edificio principal, planta baja" />
        </div>

        <div class="campo">
          <label for="responsable">Responsable</label>
          <input pInputText id="responsable" formControlName="responsable" />
          <small class="ayuda">Nombre de quien responde por las existencias. Es
            informativo: no otorga acceso al sistema.</small>
        </div>

        <div class="pie">
          <button pButton type="button" label="Cancelar" severity="secondary" text
                  (click)="dialogo = false"></button>
          <button pButton type="submit" label="Guardar" [loading]="guardando()"></button>
        </div>
      </form>
    </p-dialog>
  `,
  styles: [`
    .nombre { font-weight:500; }
    .baja { font-size:var(--t-xs); font-weight:400; color:var(--tinta-tenue);
            margin-left:.5rem; }
    .tenue { color:var(--tinta-suave); }
    .fila-acciones { text-align:right; white-space:nowrap; }
    form .campo { margin-bottom:.875rem; }
    .pie { display:flex; justify-content:flex-end; gap:.5rem; margin-top:1.25rem;
           padding-top:1rem; border-top:1px solid var(--linea-tenue); }
  `],
})
export class AlmacenListaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly servicio = inject(CatalogoService);
  private readonly mensajes = inject(MessageService);
  private readonly confirmar = inject(ConfirmationService);

  readonly almacenes = signal<AlmacenCatalogo[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly editando = signal<AlmacenCatalogo | null>(null);

  dialogo = false;

  readonly formulario = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.maxLength(20)]],
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    ubicacion: [''],
    responsable: [''],
    activo: [true],
  });

  readonly errores = new ErroresFormulario(this.formulario, {
    codigo: 'Código', nombre: 'Nombre',
    ubicacion: 'Ubicación', responsable: 'Responsable',
  });

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);

    this.servicio.almacenes().subscribe({
      next: res => {
        this.almacenes.set(res.data);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  abrir(almacen?: AlmacenCatalogo): void {
    this.editando.set(almacen ?? null);
    this.errores.limpiar();

    this.formulario.reset({
      codigo: almacen?.codigo ?? '',
      nombre: almacen?.nombre ?? '',
      ubicacion: almacen?.ubicacion ?? '',
      responsable: almacen?.responsable ?? '',
      activo: almacen?.activo ?? true,
    });

    this.dialogo = true;
  }

  guardar(): void {
    if (!this.errores.validar()) return;

    this.guardando.set(true);
    const datos = this.formulario.getRawValue();
    const enEdicion = this.editando();

    const peticion: Observable<unknown> = enEdicion
      ? this.servicio.actualizarAlmacen(enEdicion.id, datos)
      : this.servicio.crearAlmacen(datos);

    peticion.subscribe({
      next: () => {
        this.mensajes.add({
          severity: 'success',
          summary: enEdicion ? 'Almacén actualizado' : 'Almacén creado',
          detail: `${datos.codigo} — ${datos.nombre}`,
        });
        this.dialogo = false;
        this.guardando.set(false);
        this.cargar();
      },
      error: (error: HttpErrorResponse) => {
        this.guardando.set(false);
        this.errores.desdeServidor(error);
      },
    });
  }

  cambiarEstado(almacen: AlmacenCatalogo): void {
    const activar = !almacen.activo;

    this.confirmar.confirm({
      header: activar ? 'Reactivar almacén' : 'Desactivar almacén',
      message: activar
        ? `${almacen.nombre} volverá a aparecer al registrar movimientos.`
        : `${almacen.nombre} dejará de aparecer al registrar movimientos. `
          + 'Sus existencias y su kardex se conservan.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: activar ? 'Reactivar' : 'Desactivar',
      rejectLabel: 'Cancelar',
      accept: () => this.servicio.cambiarEstadoAlmacen(almacen.id, activar).subscribe(() => {
        this.mensajes.add({
          severity: 'success',
          summary: activar ? 'Almacén reactivado' : 'Almacén desactivado',
          detail: almacen.nombre,
        });
        this.cargar();
      }),
    });
  }
}
