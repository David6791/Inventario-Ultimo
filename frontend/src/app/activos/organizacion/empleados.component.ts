import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { OrganizacionService } from '../core/services/organizacion.service';
import { CentroCosto, Empleado } from '../core/models/organizacion.model';
import { ESTILOS_CONFIG } from '../core/estilos/configuracion.estilos';

@Component({
  selector: 'app-empleados',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink, TableModule,
    ButtonModule, DialogModule, DropdownModule, InputTextModule, CalendarModule,
    TagModule, ToastModule, ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <header class="encabezado">
      <div>
        <h2>Personal</h2>
        <p class="subtitulo">
          Quienes reciben bienes en custodia. No es lo mismo que los usuarios del sistema:
          la mayoría del personal responde por herramientas sin tener cuenta.
        </p>
      </div>
      <div class="acciones">
        <p-button label="Importar" icon="pi pi-file-excel" severity="secondary" [outlined]="true"
                  routerLink="/activos/organizacion/importar" />
        <p-button label="Nuevo" icon="pi pi-plus" (onClick)="abrirNuevo()" />
      </div>
    </header>

    <div class="barra">
      <span class="campo-busqueda">
        <i class="pi pi-search"></i>
        <input pInputText placeholder="Nombre, apellido, C.I. o código…"
               [(ngModel)]="busqueda" (keyup.enter)="cargar()" />
      </span>

      <div class="filtro">
        <p-dropdown [options]="centros()" optionLabel="etiqueta" optionValue="id"
                    placeholder="Centro de costo" [showClear]="true" appendTo="body"
                    [(ngModel)]="centroFiltro" (onChange)="cargar()" />
      </div>

      <p-button label="Buscar" icon="pi pi-search" [outlined]="true" (onClick)="cargar()" />
    </div>

    <p-table [value]="empleados()" [loading]="cargando()" [paginator]="true" [rows]="20"
             dataKey="id" styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 8rem">Código</th>
          <th>Nombre</th>
          <th style="width: 10rem">C.I.</th>
          <th style="width: 14rem">Cargo</th>
          <th style="width: 13rem">Centro</th>
          <th style="width: 7rem" class="centro">Acceso</th>
          <th style="width: 6rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-e>
        <tr [class.inactiva]="!e.activo">
          <td><span class="codigo">{{ e.codigo }}</span></td>

          <td>
            <div>{{ e.nombre_completo }}</div>
            <div class="secundario" *ngIf="e.fecha_baja">
              baja el {{ e.fecha_baja | date: 'dd/MM/yyyy' }}
            </div>
          </td>

          <td><span class="codigo">{{ e.ci }}{{ e.expedido ? ' ' + e.expedido : '' }}</span></td>
          <td>{{ e.cargo || '—' }}</td>

          <td>
            <div class="secundario">{{ e.area }}</div>
            <div>{{ e.centro_codigo }}</div>
          </td>

          <td class="centro">
            <i class="pi" [ngClass]="e.tiene_acceso ? 'pi-key verde' : 'pi-minus guion'"
               [title]="e.tiene_acceso ? 'Tiene cuenta en el sistema' : 'Sin cuenta'"></i>
          </td>

          <td class="centro">
            <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" size="small"
                      (onClick)="abrirEdicion(e)" />
            <p-button icon="pi pi-user-minus" [text]="true" [rounded]="true" size="small"
                      severity="danger" [disabled]="!e.activo" (onClick)="confirmarBaja(e)" />
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="7">
          <div class="vacio">
            <i class="pi pi-users"></i>
            <p class="titulo-vacio">Sin personal registrado</p>
            <p-button label="Importar desde Excel" icon="pi pi-file-excel" [text]="true"
                      routerLink="/activos/organizacion/importar" />
          </div>
        </td></tr>
      </ng-template>
    </p-table>

    <p-dialog [(visible)]="dialogVisible" [header]="editando() ? 'Editar persona' : 'Nueva persona'"
              [modal]="true" [style]="{ width: '42rem' }" [draggable]="false">
      <form [formGroup]="form" class="campos">
        <div class="campo span-2">
          <label for="codigo">Código</label>
          <input id="codigo" pInputText formControlName="codigo" />
        </div>

        <div class="campo span-2">
          <label for="ci">C.I.</label>
          <input id="ci" pInputText formControlName="ci" />
        </div>

        <div class="campo span-2">
          <label for="expedido">Expedido</label>
          <input id="expedido" pInputText formControlName="expedido" placeholder="PT" />
        </div>

        <div class="campo span-2">
          <label for="paterno">Apellido paterno</label>
          <input id="paterno" pInputText formControlName="apellido_paterno" />
        </div>

        <div class="campo span-2">
          <label for="materno">Apellido materno</label>
          <input id="materno" pInputText formControlName="apellido_materno" />
        </div>

        <div class="campo span-2">
          <label for="nombres">Nombres</label>
          <input id="nombres" pInputText formControlName="nombres" />
        </div>

        <div class="campo span-3">
          <label for="centro">Centro de costo</label>
          <p-dropdown inputId="centro" formControlName="centro_costo_id" [options]="centros()"
                      optionLabel="etiqueta" optionValue="id" placeholder="Seleccione"
                      [filter]="true" filterBy="etiqueta" appendTo="body" />
        </div>

        <div class="campo span-3">
          <label for="cargo">Cargo</label>
          <input id="cargo" pInputText formControlName="cargo" />
        </div>

        <div class="campo span-2">
          <label for="ingreso">Fecha de ingreso</label>
          <p-calendar inputId="ingreso" formControlName="fecha_ingreso"
                      dateFormat="dd/mm/yy" [showIcon]="true" appendTo="body" />
        </div>

        <div class="campo span-2">
          <label for="movil">Móvil</label>
          <input id="movil" pInputText formControlName="movil" />
        </div>

        <div class="campo span-2">
          <label for="email">Correo</label>
          <input id="email" pInputText formControlName="email" />
        </div>

        <div class="span-6">
          <div class="nota nota-neutra">
            <i class="pi pi-key"></i>
            <span>
              El vínculo con una cuenta del sistema es opcional y se configura aparte.
              Una persona puede recibir bienes sin tener acceso.
            </span>
          </div>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="dialogVisible = false" />
        <p-button label="Guardar" icon="pi pi-check" [disabled]="form.invalid || guardando()"
                  [loading]="guardando()" (onClick)="guardar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CONFIG, `
    .verde { color: #16a34a; }
  `],
})
export class EmpleadosComponent implements OnInit {
  private readonly servicio = inject(OrganizacionService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly empleados = signal<Empleado[]>([]);
  readonly centros = signal<CentroCosto[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly editando = signal<Empleado | null>(null);

  busqueda = '';
  centroFiltro: number | null = null;
  dialogVisible = false;

  readonly form = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    nombres: ['', [Validators.required, Validators.maxLength(120)]],
    apellido_paterno: [''],
    apellido_materno: [''],
    ci: ['', [Validators.required, Validators.maxLength(25)]],
    expedido: [''],
    cargo: [''],
    centro_costo_id: [null as number | null, Validators.required],
    fecha_ingreso: [null as Date | null],
    movil: [''],
    email: [''],
  });

  ngOnInit(): void {
    this.servicio.listarCentros().subscribe((c) => this.centros.set(c));
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);

    this.servicio.listarEmpleados({
      buscar: this.busqueda,
      centro_costo_id: this.centroFiltro ?? undefined,
      incluir_bajas: true,
    }).subscribe({
      next: (e) => { this.empleados.set(e); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  abrirNuevo(): void {
    this.editando.set(null);
    this.form.reset({ centro_costo_id: this.centroFiltro });
    this.dialogVisible = true;
  }

  abrirEdicion(e: Empleado): void {
    this.editando.set(e);
    this.form.patchValue({
      ...e,
      fecha_ingreso: e.fecha_ingreso ? new Date(e.fecha_ingreso) : null,
    });
    this.dialogVisible = true;
  }

  guardar(): void {
    this.guardando.set(true);

    const v = this.form.getRawValue();
    const datos: any = { ...v, fecha_ingreso: this.aFecha(v.fecha_ingreso) };

    const actual = this.editando();

    const peticion = actual
      ? this.servicio.actualizarEmpleado(actual.id, datos)
      : this.servicio.crearEmpleado(datos);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogVisible = false;
        this.toast.add({ severity: 'success', summary: 'Persona guardada' });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({
          severity: 'error', summary: 'No se pudo guardar',
          detail: e?.error?.message ?? this.primerError(e) ?? 'Revise los datos.',
          life: 7000,
        });
      },
    });
  }

  /**
   * La baja falla si tiene bienes a cargo. Es la regla que sostiene el
   * descargo laboral: sin devolución no hay finiquito.
   */
  confirmarBaja(e: Empleado): void {
    this.confirm.confirm({
      header: 'Dar de baja',
      message:
        `¿Dar de baja a ${e.nombre_completo}? Si tiene bienes a su cargo, primero hay `
        + 'que emitir la devolución: sin descargo no se procesa el finiquito.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Dar de baja',
      rejectLabel: 'Cancelar',
      accept: () => {
        const hoy = new Date().toISOString().slice(0, 10);

        this.servicio.darDeBaja(e.id, hoy).subscribe({
          next: (r) => {
            this.toast.add({ severity: 'info', summary: r.mensaje, life: 6000 });
            this.cargar();
          },
          error: (err) =>
            this.toast.add({
              severity: 'warn', summary: 'No se dio de baja',
              detail: err?.error?.mensaje ?? '', life: 9000,
            }),
        });
      },
    });
  }

  private primerError(e: any): string | null {
    const errores = e?.error?.errors;
    if (!errores) return null;
    return (Object.values(errores)[0] as string[])?.[0] ?? null;
  }

  private aFecha(v: Date | null): string | null {
    if (!v) return null;
    const d = new Date(v);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
