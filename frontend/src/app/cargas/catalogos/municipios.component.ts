import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { Municipio, Opcion } from '../core/models/cargas.model';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';

@Component({
  selector: 'app-municipios',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule, DropdownModule,
    InputTextModule, ToastModule, ConfirmDialogModule, TienePermisoDirective,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <header class="encabezado">
      <div>
        <h2>Municipios</h2>
        <p class="subtitulo">
          Municipios productores. La regalía minera se reparte 85 % a la Gobernación y 15 %
          al municipio de donde sale el mineral, por eso cada mina debe tener el suyo.
        </p>
      </div>
      <div class="acciones" *appTienePermiso="'cargas.catalogos'">
        <p-button label="Nuevo municipio" icon="pi pi-plus" (onClick)="abrirNuevo()" />
      </div>
    </header>

    <p-table #tabla [value]="municipios()" [loading]="cargando()" [paginator]="true" [rows]="25"
             dataKey="id" styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 8rem">Código</th>
          <th>Municipio</th>
          <th style="width: 11rem">Departamento</th>
          <th style="width: 8rem" class="derecha">Cooperativas</th>
          <th style="width: 6rem" class="derecha">Minas</th>
          <th style="width: 6rem"></th>
        </tr>
      </ng-template>
      <ng-template pTemplate="body" let-m>
        <tr>
          <td><span class="codigo" *ngIf="m.codigo; else guion">{{ m.codigo }}</span></td>
          <td>{{ m.nombre }}</td>
          <td>{{ etiquetaDepartamento(m.departamento) }}</td>
          <td class="derecha contador">{{ m.cooperativas_count }}</td>
          <td class="derecha contador">{{ m.minas_count }}</td>
          <td class="centro">
            <ng-container *appTienePermiso="'cargas.catalogos'">
              <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" size="small" (onClick)="abrirEdicion(m)" />
              <p-button icon="pi pi-trash" [text]="true" [rounded]="true" size="small" severity="danger"
                        [disabled]="m.cooperativas_count + m.minas_count > 0" (onClick)="confirmarEliminar(m)" />
            </ng-container>
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="6"><div class="vacio"><i class="pi pi-map-marker"></i>
          <p class="titulo-vacio">Sin municipios registrados</p></div></td></tr>
      </ng-template>
    </p-table>
    <ng-template #guion><span class="guion">—</span></ng-template>

    <p-dialog [(visible)]="dialogVisible" [header]="editando() ? 'Editar municipio' : 'Nuevo municipio'"
              [modal]="true" [style]="{ width: '32rem' }" [draggable]="false">
      <form [formGroup]="form" class="campos">
        <div class="campo span-4">
          <label for="nombre">Nombre</label>
          <input id="nombre" pInputText formControlName="nombre" maxlength="100" />
        </div>
        <div class="campo span-2">
          <label for="codigo">Código</label>
          <input id="codigo" pInputText formControlName="codigo" maxlength="10" placeholder="Opcional" />
        </div>
        <div class="campo span-6">
          <label for="departamento">Departamento</label>
          <p-dropdown inputId="departamento" formControlName="departamento" [options]="departamentos()"
                      optionLabel="etiqueta" optionValue="valor" appendTo="body" />
        </div>
      </form>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="dialogVisible = false" />
        <p-button label="Guardar" icon="pi pi-check" [disabled]="form.invalid || guardando()"
                  [loading]="guardando()" (onClick)="guardar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CARGAS],
})
export class MunicipiosComponent implements OnInit {
  private readonly servicio = inject(CatalogosCargasService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly municipios = signal<Municipio[]>([]);
  readonly departamentos = signal<Opcion[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly editando = signal<Municipio | null>(null);
  dialogVisible = false;

  readonly form = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    codigo: [''],
    departamento: ['POTOSI', Validators.required],
  });

  ngOnInit(): void {
    this.servicio.opciones$.subscribe((o) => this.departamentos.set(o.departamentos));
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listarMunicipios().subscribe({
      next: (m) => { this.municipios.set(m); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  etiquetaDepartamento(valor: string): string {
    return this.departamentos().find((d) => d.valor === valor)?.etiqueta ?? valor;
  }

  abrirNuevo(): void {
    this.editando.set(null);
    this.form.reset({ departamento: 'POTOSI' });
    this.dialogVisible = true;
  }

  abrirEdicion(m: Municipio): void {
    this.editando.set(m);
    this.form.reset(m as any);
    this.dialogVisible = true;
  }

  guardar(): void {
    this.guardando.set(true);
    this.servicio.guardarMunicipio(this.form.getRawValue() as Partial<Municipio>, this.editando()?.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogVisible = false;
        this.toast.add({ severity: 'success', summary: 'Municipio guardado' });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo guardar', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }

  confirmarEliminar(m: Municipio): void {
    this.confirm.confirm({
      header: 'Eliminar municipio',
      message: `¿Eliminar «${m.nombre}»? Solo se puede si ninguna cooperativa ni mina lo usa.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      accept: () => this.servicio.eliminarMunicipio(m.id).subscribe({
        next: () => { this.toast.add({ severity: 'info', summary: 'Municipio eliminado' }); this.cargar(); },
        error: (e) => this.toast.add({ severity: 'warn', summary: 'No se eliminó', detail: mensajeDeError(e) }),
      }),
    });
  }
}
