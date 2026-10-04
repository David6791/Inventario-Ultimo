import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CatalogoService } from '../../core/services/catalogo.service';
import { Clase, Subclase } from '../../core/models/catalogo.model';
import { ESTILOS_CONFIG } from '../../core/estilos/configuracion.estilos';

@Component({
  selector: 'app-subclases',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TableModule, ButtonModule,
    DialogModule, DropdownModule, InputTextModule, InputNumberModule, TagModule, ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Subclases</h2>
        <p class="subtitulo">
          Detallan la clase y proponen la vida útil económica al dar de alta un bien.
        </p>
      </div>
      <div class="acciones">
        <p-button label="Nueva subclase" icon="pi pi-plus" (onClick)="abrirNueva()" />
      </div>
    </header>

    <div class="nota nota-encabezado">
      <i class="pi pi-info-circle"></i>
      <span>
        La <strong>vida útil económica</strong> es la estimación real de uso y puede diferir
        de la fiscal, que fija el Anexo del Art. 22 y vive en la clase. Esa divergencia es
        la que después separa las dos series de valuación.
      </span>
    </div>

    <div class="barra">
      <div class="filtro">
        <p-dropdown [options]="clases()" [(ngModel)]="claseFiltro" optionLabel="nombre"
                    optionValue="id" placeholder="Todas las clases" [showClear]="true"
                    appendTo="body" (onChange)="cargarSubclases()" />
      </div>
      <span class="campo-busqueda">
        <i class="pi pi-search"></i>
        <input pInputText placeholder="Nombre de la subclase…" #busqueda
               (input)="tabla.filterGlobal(busqueda.value, 'contains')" />
      </span>
    </div>

    <p-table #tabla [value]="subclases()" [loading]="cargando()" [paginator]="true" [rows]="15"
             [globalFilterFields]="['nombre']" dataKey="id" styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 8rem">Código</th>
          <th style="width: 18rem">Clase</th>
          <th>Subclase</th>
          <th style="width: 11rem" class="derecha">Vida útil económica</th>
          <th style="width: 11rem" class="derecha">Vida útil fiscal</th>
          <th style="width: 7rem" class="centro">Estado</th>
          <th style="width: 10rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-s>
        <tr [class.inactiva]="!s.activo">
          <td><span class="codigo">{{ s.clase?.codigo }}-{{ s.codigo }}</span></td>
          <td class="secundario">{{ s.clase?.nombre }}</td>
          <td>{{ s.nombre }}</td>

          <td class="derecha numero">
            <span *ngIf="s.vida_util_economica_meses; else heredada">
              {{ s.vida_util_economica_meses / 12 | number: '1.0-1' }} años
            </span>
            <ng-template #heredada><span class="guion">hereda</span></ng-template>
          </td>

          <td class="derecha numero guion">{{ vidaFiscal(s) }}</td>

          <td class="centro">
            <p-tag [value]="s.activo ? 'Activa' : 'Inactiva'"
                   [severity]="s.activo ? 'success' : 'secondary'" />
          </td>

          <td class="centro">
            <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" size="small"
                      (onClick)="abrirEdicion(s)" />
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="7">
          <div class="vacio">
            <i class="pi pi-tags"></i>
            <p class="titulo-vacio">
              {{ claseFiltro ? 'Esta clase todavía no tiene subclases' : 'Sin subclases registradas' }}
            </p>
            <p-button label="Crear la primera" icon="pi pi-plus" [text]="true" (onClick)="abrirNueva()" />
          </div>
        </td></tr>
      </ng-template>
    </p-table>

    <p-dialog [(visible)]="dialogVisible" [header]="editando() ? 'Editar subclase' : 'Nueva subclase'"
              [modal]="true" [style]="{ width: '34rem' }" [draggable]="false">
      <form [formGroup]="form" class="campos">
        <div class="campo span-6">
          <label for="clase">Clase</label>
          <p-dropdown inputId="clase" formControlName="clase_id" [options]="clases()"
                      optionLabel="nombre" optionValue="id" placeholder="Seleccione"
                      [filter]="true" filterBy="nombre" appendTo="body" />
        </div>

        <div class="campo span-2">
          <label for="codigo">Código</label>
          <input id="codigo" pInputText formControlName="codigo" maxlength="2" placeholder="02" />
          <small>Único dentro de la clase</small>
        </div>

        <div class="campo span-4">
          <label for="nombre">Nombre</label>
          <input id="nombre" pInputText formControlName="nombre" />
        </div>

        <div class="campo span-6">
          <label for="vida">Vida útil económica (meses)</label>
          <p-inputNumber inputId="vida" formControlName="vida_util_economica_meses"
                         [min]="1" [max]="1200" />
          <small>
            Dejar vacío para heredar la vida útil fiscal de la clase.
            <ng-container *ngIf="form.value.vida_util_economica_meses">
              Equivale a {{ form.value.vida_util_economica_meses! / 12 | number: '1.0-1' }} años.
            </ng-container>
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
  styles: [ESTILOS_CONFIG],
})
export class SubclasesComponent implements OnInit {
  private readonly servicio = inject(CatalogoService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);

  readonly subclases = signal<Subclase[]>([]);
  readonly clases = signal<Clase[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly editando = signal<Subclase | null>(null);

  claseFiltro: number | null = null;
  dialogVisible = false;

  readonly form = this.fb.group({
    clase_id: [null as number | null, Validators.required],
    codigo: ['', [Validators.required, Validators.pattern(/^\d{2}$/)]],
    nombre: ['', [Validators.required, Validators.maxLength(120)]],
    vida_util_economica_meses: [null as number | null],
  });

  ngOnInit(): void {
    this.servicio.listarClases(true).subscribe((c) => this.clases.set(c));
    this.cargarSubclases();
  }

  cargarSubclases(): void {
    this.cargando.set(true);
    this.servicio.listarSubclases(this.claseFiltro ?? undefined).subscribe({
      next: (data) => { this.subclases.set(data); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  /** Muestra la vida útil fiscal heredada de la clase, para comparar. */
  vidaFiscal(s: Subclase): string {
    const clase = this.clases().find((c) => c.id === s.clase_id);
    if (!clase?.vida_util_fiscal_meses) return 'no deprecia';
    return `${clase.vida_util_fiscal_meses / 12} años`;
  }

  abrirNueva(): void {
    this.editando.set(null);
    this.form.reset({ clase_id: this.claseFiltro });
    this.dialogVisible = true;
  }

  abrirEdicion(s: Subclase): void {
    this.editando.set(s);
    this.form.patchValue(s);
    this.dialogVisible = true;
  }

  guardar(): void {
    this.guardando.set(true);
    const datos = this.form.value as Partial<Subclase>;
    const actual = this.editando();

    const peticion = actual
      ? this.servicio.actualizarSubclase(actual.id, datos)
      : this.servicio.crearSubclase(datos);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogVisible = false;
        this.toast.add({ severity: 'success', summary: 'Subclase guardada' });
        this.cargarSubclases();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({
          severity: 'error', summary: 'No se pudo guardar',
          detail: e?.error?.message ?? 'El código debe ser único dentro de la clase.',
        });
      },
    });
  }
}
