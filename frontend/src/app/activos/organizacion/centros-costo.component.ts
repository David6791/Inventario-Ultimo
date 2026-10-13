import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { OrganizacionService } from '../core/services/organizacion.service';
import { CatalogoService } from '../core/services/catalogo.service';
import { ESTILOS_CONFIG } from '../core/estilos/configuracion.estilos';
import { Almacen, Area, CentroCosto } from '../core/models/organizacion.model';

@Component({
  selector: 'app-centros-costo',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink, TableModule, ButtonModule,
    DialogModule, DropdownModule, InputTextModule, TagModule, ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Centros de costo</h2>
        <p class="subtitulo">
          La unidad organizativa de la empresa. Cada centro tiene su almacén, su personal
          y sus ubicaciones; los activos se imputan a un centro y se asignan a su gente.
        </p>
      </div>
      <div class="acciones">
        <p-button label="Nuevo centro" icon="pi pi-plus" (onClick)="abrirNuevo()" />
      </div>
    </header>

    <div class="nota nota-aviso nota-encabezado" *ngIf="sinAmbito() > 0">
      <i class="pi pi-eye-slash"></i>
      <span>
        Hay <strong>{{ sinAmbito() }}</strong> centro(s) sin almacén asignado.
        <strong>Nadie puede ver sus activos</strong>: el almacén es lo que define
        quién alcanza a cada centro.
      </span>
    </div>

    <p-table [value]="centros()" [loading]="cargando()" dataKey="id"
             styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 10rem">Área</th>
          <th style="width: 13rem">Código</th>
          <th>Centro de costo</th>
          <th style="width: 14rem">Almacén</th>
          <th style="width: 7rem" class="centro">Personal</th>
          <th style="width: 7rem" class="centro">Activos</th>
          <th style="width: 5rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-c>
        <tr [class.inactiva]="!c.activo" [class.fila-alerta]="c.sin_ambito">
          <td><p-tag [value]="c.area" severity="secondary" /></td>
          <td><span class="codigo">{{ c.codigo }}</span></td>
          <td>{{ c.nombre }}</td>

          <td>
            <span *ngIf="c.almacen; else sinAlmacen">{{ c.almacen }}</span>
            <ng-template #sinAlmacen>
              <span class="alerta">
                <i class="pi pi-exclamation-triangle"></i> sin asignar
              </span>
            </ng-template>
          </td>

          <td class="centro numero">{{ c.empleados_count ?? 0 }}</td>
          <td class="centro numero">{{ c.activos_count ?? 0 }}</td>

          <td class="centro">
            <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" size="small"
                      (onClick)="abrirEdicion(c)" />
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="7">
          <div class="vacio">
            <i class="pi pi-building"></i>
            <p class="titulo-vacio">Sin centros de costo</p>
            <p class="secundario">
              Se crean solos al importar personal, o puede cargarlos a mano.
            </p>
            <p-button label="Importar personal" icon="pi pi-file-excel" [text]="true"
                      routerLink="/activos/organizacion/importar" />
          </div>
        </td></tr>
      </ng-template>
    </p-table>

    <p-dialog [(visible)]="dialogVisible" [header]="editando() ? 'Editar centro' : 'Nuevo centro'"
              [modal]="true" [style]="{ width: '36rem' }" [draggable]="false">
      <form [formGroup]="form" class="campos">
        <div class="campo span-3">
          <label for="area">Área</label>
          <p-dropdown inputId="area" formControlName="area_id" [options]="areas()"
                      optionLabel="codigo" optionValue="id" placeholder="Seleccione"
                      appendTo="body" />
        </div>

        <div class="campo span-3">
          <label for="codigo">Código</label>
          <input id="codigo" pInputText formControlName="codigo" placeholder="ACOPIO_PORCO" />
        </div>

        <div class="campo span-6">
          <label for="nombre">Nombre</label>
          <input id="nombre" pInputText formControlName="nombre" />
        </div>

        <div class="campo span-6">
          <label for="almacen">Almacén</label>
          <p-dropdown inputId="almacen" formControlName="almacen_id" [options]="almacenes()"
                      optionLabel="nombre" optionValue="id" placeholder="Seleccione"
                      [showClear]="true" [filter]="true" filterBy="nombre" appendTo="body" />
          <small>
            Define quién ve los activos de este centro: los usuarios que tengan
            este almacén asignado. Sin almacén, el centro es invisible.
          </small>
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
    .fila-alerta { background: #fffbf5; }

    .alerta {
      display: inline-flex; align-items: center; gap: 0.3rem;
      font-size: 0.8rem; color: #b45309;
    }
  `],
})
export class CentrosCostoComponent implements OnInit {
  private readonly servicio = inject(OrganizacionService);
  private readonly catalogos = inject(CatalogoService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);

  readonly centros = signal<CentroCosto[]>([]);
  readonly areas = signal<Area[]>([]);
  readonly almacenes = signal<Almacen[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly editando = signal<CentroCosto | null>(null);

  dialogVisible = false;

  readonly form = this.fb.group({
    area_id: [null as number | null, Validators.required],
    codigo: ['', [Validators.required, Validators.maxLength(40)]],
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    almacen_id: [null as number | null],
  });

  ngOnInit(): void {
    this.servicio.listarAreas().subscribe((a) => this.areas.set(a));

    this.servicio.listarAlmacenes().subscribe({
      next: (a: Almacen[]) => this.almacenes.set(a),
      error: () => this.toast.add({
        severity: 'warn', summary: 'No se pudo cargar la lista de almacenes',
      }),
    });

    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listarCentros(true).subscribe({
      next: (c) => { this.centros.set(c); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  sinAmbito(): number {
    return this.centros().filter((c) => c.sin_ambito && c.activo).length;
  }

  abrirNuevo(): void {
    this.editando.set(null);
    this.form.reset();
    this.dialogVisible = true;
  }

  abrirEdicion(c: CentroCosto): void {
    this.editando.set(c);
    this.form.patchValue(c);
    this.dialogVisible = true;
  }

    guardar(): void {
    this.guardando.set(true);

    const datos = this.form.value as Partial<CentroCosto>;
    const actual = this.editando();

    const alGuardar = () => {
      this.guardando.set(false);
      this.dialogVisible = false;
      this.toast.add({ severity: 'success', summary: 'Centro guardado' });
      this.cargar();
    };

    const alFallar = (e: any) => {
      this.guardando.set(false);
      this.toast.add({
        severity: 'error',
        summary: 'No se pudo guardar',
        detail: e?.error?.message ?? 'Revise los datos.',
      });
    };

    if (actual) {
      this.servicio.actualizarCentro(actual.id, datos)
        .subscribe({ next: alGuardar, error: alFallar });
    } else {
      this.servicio.crearCentro(datos)
        .subscribe({ next: alGuardar, error: alFallar });
    }
  }
}
