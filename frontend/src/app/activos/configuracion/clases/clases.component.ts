import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ConfirmationService, MessageService } from 'primeng/api';
import { CatalogoService } from '../../core/services/catalogo.service';
import { Clase } from '../../core/models/catalogo.model';
import { ESTILOS_CONFIG } from '../../core/estilos/configuracion.estilos';

@Component({
  selector: 'app-clases',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule,
    InputTextModule, InputNumberModule, ToggleButtonModule, TagModule,
    ToastModule, ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <header class="encabezado">
      <div>
        <h2>Clases de activo</h2>
        <p class="subtitulo">
          Alineadas al Anexo del Artículo 22 del DS 24051. La vida útil fiscal
          se hereda al dar de alta un bien.
        </p>
      </div>
      <div class="acciones">
        <p-button label="Nueva clase" icon="pi pi-plus" (onClick)="abrirNueva()" />
      </div>
    </header>

    <div class="barra">
      <span class="campo-busqueda">
        <i class="pi pi-search"></i>
        <input pInputText placeholder="Código o nombre…" #busqueda
               (input)="tabla.filterGlobal(busqueda.value, 'contains')" />
      </span>
    </div>

    <p-table #tabla [value]="clases()" [loading]="cargando()" [paginator]="true" [rows]="15"
             [globalFilterFields]="['codigo', 'nombre']" dataKey="id" styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 6rem">Código</th>
          <th>Nombre</th>
          <th style="width: 7rem" class="centro">Deprecia</th>
          <th style="width: 10rem" class="derecha">Vida útil fiscal</th>
          <th style="width: 8rem" class="derecha">Coeficiente</th>
          <th style="width: 7rem" class="centro">Subclases</th>
          <th style="width: 7rem" class="centro">Estado</th>
          <th style="width: 10rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-c>
        <tr [class.inactiva]="!c.activo">
          <td><span class="codigo">{{ c.codigo }}</span></td>

          <td>
            {{ c.nombre }}
            <div class="secundario" *ngIf="c.cuenta_activo">Cuenta {{ c.cuenta_activo }}</div>
          </td>

          <td class="centro">
            <i class="pi" [ngClass]="c.deprecia ? 'pi-check verde' : 'pi-minus guion'"></i>
          </td>

          <td class="derecha numero">
            <span *ngIf="c.vida_util_fiscal_meses; else sinVida">
              {{ c.vida_util_fiscal_meses / 12 }} años
            </span>
            <ng-template #sinVida><span class="guion">—</span></ng-template>
          </td>

          <td class="derecha numero">
            <span *ngIf="c.coeficiente_fiscal; else sinCoef">
              {{ +c.coeficiente_fiscal * 100 | number: '1.1-2' }} %
            </span>
            <ng-template #sinCoef><span class="guion">—</span></ng-template>
          </td>

          <td class="centro numero">{{ c.subclases_count ?? 0 }}</td>

          <td class="centro">
            <p-tag [value]="c.activo ? 'Activa' : 'Inactiva'"
                   [severity]="c.activo ? 'success' : 'secondary'" />
          </td>

          <td class="centro">
            <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" size="small"
                      (onClick)="abrirEdicion(c)" />
            <p-button icon="pi pi-ban" [text]="true" [rounded]="true" size="small" severity="danger"
                      [disabled]="!c.activo" (onClick)="confirmarDesactivar(c)" />
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="8">
          <div class="vacio">
            <i class="pi pi-sitemap"></i>
            <p class="titulo-vacio">Sin clases registradas</p>
          </div>
        </td></tr>
      </ng-template>
    </p-table>

    <p-dialog [(visible)]="dialogVisible" [header]="editando() ? 'Editar clase' : 'Nueva clase'"
              [modal]="true" [style]="{ width: '36rem' }" [draggable]="false">
      <form [formGroup]="form" class="campos">
        <div class="campo span-2">
          <label for="codigo">Código</label>
          <input id="codigo" pInputText formControlName="codigo" maxlength="2" placeholder="05" />
          <small>Dos dígitos</small>
        </div>

        <div class="campo span-4">
          <label for="nombre">Nombre</label>
          <input id="nombre" pInputText formControlName="nombre" />
        </div>

        <div class="campo span-6">
          <label>Tratamiento</label>
          <p-toggleButton formControlName="deprecia"
                          onLabel="Deprecia" offLabel="No deprecia (terreno)"
                          onIcon="pi pi-calculator" offIcon="pi pi-minus-circle"
                          (onChange)="alCambiarDeprecia()" />
        </div>

        <ng-container *ngIf="form.value.deprecia">
          <div class="campo span-3">
            <label for="vida">Vida útil fiscal (meses)</label>
            <p-inputNumber inputId="vida" formControlName="vida_util_fiscal_meses"
                           [min]="1" [max]="1200" />
            <small *ngIf="form.value.vida_util_fiscal_meses">
              {{ form.value.vida_util_fiscal_meses! / 12 | number: '1.0-1' }} años
            </small>
          </div>

          <div class="campo span-3">
            <label for="coef">Coeficiente anual</label>
            <p-inputNumber inputId="coef" formControlName="coeficiente_fiscal" mode="decimal"
                           [minFractionDigits]="4" [maxFractionDigits]="4" [min]="0" [max]="1" />
            <small>0,2500 equivale a 25 %</small>
          </div>
        </ng-container>

        <div class="campo span-2">
          <label for="ca">Cuenta activo</label>
          <input id="ca" pInputText formControlName="cuenta_activo" />
        </div>
        <div class="campo span-2">
          <label for="cd">Dep. acumulada</label>
          <input id="cd" pInputText formControlName="cuenta_dep_acumulada" />
        </div>
        <div class="campo span-2">
          <label for="cg">Gasto depreciación</label>
          <input id="cg" pInputText formControlName="cuenta_gasto_dep" />
        </div>
      </form>

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="dialogVisible = false" />
        <p-button label="Guardar" icon="pi pi-check" [disabled]="form.invalid || guardando()"
                  [loading]="guardando()" (onClick)="guardar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CONFIG, `.verde { color: #16a34a; }`],
})
export class ClasesComponent implements OnInit {
  private readonly servicio = inject(CatalogoService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly clases = signal<Clase[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly editando = signal<Clase | null>(null);

  dialogVisible = false;

  readonly form = this.fb.group({
    codigo: ['', [Validators.required, Validators.pattern(/^\d{2}$/)]],
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    deprecia: [true],
    vida_util_fiscal_meses: [null as number | null],
    coeficiente_fiscal: [null as number | null],
    cuenta_activo: [''],
    cuenta_dep_acumulada: [''],
    cuenta_gasto_dep: [''],
  });

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listarClases().subscribe({
      next: (data) => { this.clases.set(data); this.cargando.set(false); },
      error: () => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo cargar el catálogo' });
      },
    });
  }

  abrirNueva(): void {
    this.editando.set(null);
    this.form.reset({ deprecia: true });
    this.dialogVisible = true;
  }

  abrirEdicion(clase: Clase): void {
    this.editando.set(clase);
    this.form.patchValue({
      ...clase,
      coeficiente_fiscal: clase.coeficiente_fiscal ? +clase.coeficiente_fiscal : null,
    });
    this.dialogVisible = true;
  }

  /** Una clase que no deprecia no lleva vida útil ni coeficiente. */
  alCambiarDeprecia(): void {
    if (!this.form.value.deprecia) {
      this.form.patchValue({ vida_util_fiscal_meses: null, coeficiente_fiscal: null });
    }
  }

  guardar(): void {
    this.guardando.set(true);
    const datos = this.form.value as Partial<Clase>;
    const actual = this.editando();

    const peticion = actual
      ? this.servicio.actualizarClase(actual.id, datos)
      : this.servicio.crearClase(datos);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogVisible = false;
        this.toast.add({ severity: 'success', summary: 'Clase guardada' });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({
          severity: 'error', summary: 'No se pudo guardar',
          detail: e?.error?.message ?? 'Revise los datos ingresados.',
        });
      },
    });
  }

  confirmarDesactivar(clase: Clase): void {
    this.confirm.confirm({
      header: 'Desactivar clase',
      message:
        `¿Desactivar «${clase.nombre}»? Los catálogos no se eliminan: los referencian ` +
        'activos históricos y períodos de valuación ya cerrados.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      accept: () =>
        this.servicio.desactivarClase(clase.id).subscribe({
          next: (r) => {
            this.toast.add({ severity: 'info', summary: r.mensaje ?? 'Clase desactivada' });
            this.cargar();
          },
        }),
    });
  }
}
