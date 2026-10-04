import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CatalogoService } from '../../core/services/catalogo.service';
import { Parametro } from '../../core/models/catalogo.model';
import { ESTILOS_CONFIG } from '../../core/estilos/configuracion.estilos';

@Component({
  selector: 'app-parametros',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, TableModule, ButtonModule, DialogModule,
    InputTextModule, CalendarModule, TagModule, ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Parámetros del módulo</h2>
        <p class="subtitulo">
          Valores que gobiernan el comportamiento del módulo de activos fijos.
        </p>
      </div>
    </header>

    <div class="nota nota-aviso nota-encabezado">
      <i class="pi pi-history"></i>
      <span>
        Los parámetros <strong>no se editan: se versionan</strong>. Cambiar un valor cierra la
        vigencia anterior y abre una nueva. Así un cierre de 2026 se puede reconstruir con el
        umbral que regía en 2026, no con el de hoy.
      </span>
    </div>

    <p-table [value]="parametros()" [loading]="cargando()" dataKey="id"
             styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 20rem">Parámetro</th>
          <th style="width: 10rem" class="derecha">Valor vigente</th>
          <th>Descripción</th>
          <th style="width: 10rem">Vigente desde</th>
          <th style="width: 10rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-p>
        <tr>
          <td><span class="codigo">{{ p.clave }}</span></td>

          <td class="derecha">
            <span class="valor" [ngClass]="'tipo-' + p.tipo_dato">{{ formatear(p) }}</span>
          </td>

          <td class="secundario">{{ p.descripcion }}</td>

          <td class="numero">{{ p.vigente_desde | date: 'dd/MM/yyyy' }}</td>

          <td class="centro">
            <p-button icon="pi pi-pencil" [text]="true" [rounded]="true" size="small"
                      (onClick)="abrirCambio(p)" />
            <p-button icon="pi pi-history" [text]="true" [rounded]="true" size="small"
                      (onClick)="verHistorial(p)" />
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="5">
          <div class="vacio">
            <i class="pi pi-sliders-h"></i>
            <p class="titulo-vacio">Sin parámetros cargados</p>
          </div>
        </td></tr>
      </ng-template>
    </p-table>

    <!-- -------------------------------------------------- Cambio de valor -->
    <p-dialog [(visible)]="dialogCambio" header="Cambiar parámetro" [modal]="true"
              [style]="{ width: '32rem' }" [draggable]="false">
      <div class="clave-actual">
        <span class="codigo">{{ seleccionado()?.clave }}</span>
        <p class="secundario">{{ seleccionado()?.descripcion }}</p>
      </div>

      <form [formGroup]="form" class="campos">
        <div class="campo span-3">
          <label>Valor actual</label>
          <div class="valor-actual">{{ seleccionado()?.valor }}</div>
        </div>

        <div class="campo span-3">
          <label for="valor">Nuevo valor</label>
          <input id="valor" pInputText formControlName="valor" />
        </div>

        <div class="campo span-6">
          <label for="desde">Vigente desde</label>
          <p-calendar inputId="desde" formControlName="vigente_desde" dateFormat="dd/mm/yy"
                      [minDate]="manana" [showIcon]="true" appendTo="body" />
          <small>
            Debe ser a futuro: los períodos ya calculados conservan el valor anterior.
          </small>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="dialogCambio = false" />
        <p-button label="Aplicar cambio" icon="pi pi-check"
                  [disabled]="form.invalid || guardando()" [loading]="guardando()"
                  (onClick)="guardar()" />
      </ng-template>
    </p-dialog>

    <!-- ------------------------------------------------------- Historial -->
    <p-dialog [(visible)]="dialogHistorial" header="Historial de vigencias" [modal]="true"
              [style]="{ width: '40rem' }" [draggable]="false">
      <p class="secundario mb-1">{{ seleccionado()?.clave }}</p>

      <p-table [value]="historial()" styleClass="p-datatable-sm tabla">
        <ng-template pTemplate="header">
          <tr>
            <th style="width: 9rem" class="derecha">Valor</th>
            <th style="width: 10rem">Desde</th>
            <th>Hasta</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-h>
          <tr>
            <td class="derecha"><span class="valor">{{ h.valor }}</span></td>
            <td class="numero">{{ h.vigente_desde | date: 'dd/MM/yyyy' }}</td>
            <td>
              <span *ngIf="h.vigente_hasta; else vigente" class="numero">
                {{ h.vigente_hasta | date: 'dd/MM/yyyy' }}
              </span>
              <ng-template #vigente><p-tag value="Vigente" severity="success" /></ng-template>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </p-dialog>
  `,
  styles: [ESTILOS_CONFIG, `
    .valor {
      font-family: ui-monospace, 'SF Mono', Menlo, monospace;
      font-size: 0.85rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .tipo-booleano { font-family: inherit; font-weight: 550; }

    .clave-actual {
      padding-bottom: 0.9rem;
      margin-bottom: 0.25rem;
      border-bottom: 1px solid var(--surface-border, #f1f3f5);
    }

    .clave-actual p { margin: 0.25rem 0 0; }

    .valor-actual {
      padding: 0.55rem 0.75rem;
      font-family: ui-monospace, 'SF Mono', Menlo, monospace;
      font-size: 0.85rem;
      color: var(--text-color-secondary, #6b7280);
      background: var(--surface-ground, #f9fafb);
      border: 1px solid var(--surface-border, #e5e7eb);
      border-radius: 6px;
    }

    .mb-1 { margin-bottom: 0.75rem; }
  `],
})
export class ParametrosComponent implements OnInit {
  private readonly servicio = inject(CatalogoService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);

  readonly parametros = signal<Parametro[]>([]);
  readonly historial = signal<Parametro[]>([]);
  readonly seleccionado = signal<Parametro | null>(null);
  readonly cargando = signal(false);
  readonly guardando = signal(false);

  dialogCambio = false;
  dialogHistorial = false;

  readonly manana = new Date(Date.now() + 86_400_000);

  readonly form = this.fb.group({
    valor: ['', Validators.required],
    vigente_desde: [this.manana as Date | null, Validators.required],
  });

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listarParametros().subscribe({
      next: (data) => { this.parametros.set(data); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  /** Los booleanos se leen mejor como sí/no que como true/false. */
  formatear(p: Parametro): string {
    if (p.tipo_dato === 'booleano') {
      return p.valor === 'true' || p.valor === '1' ? 'Sí' : 'No';
    }
    return p.valor;
  }

  abrirCambio(p: Parametro): void {
    this.seleccionado.set(p);
    this.form.reset({ valor: p.valor, vigente_desde: this.manana });
    this.dialogCambio = true;
  }

  verHistorial(p: Parametro): void {
    this.seleccionado.set(p);
    this.servicio.historialParametro(p.clave).subscribe((data) => {
      this.historial.set(data);
      this.dialogHistorial = true;
    });
  }

  guardar(): void {
    const p = this.seleccionado();
    const { valor, vigente_desde } = this.form.value;
    if (!p || !valor || !vigente_desde) return;

    this.guardando.set(true);
    const fecha = new Date(vigente_desde).toISOString().slice(0, 10);

    this.servicio.actualizarParametro(p.clave, valor, fecha).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.dialogCambio = false;
        this.toast.add({ severity: 'success', summary: r.mensaje ?? 'Parámetro actualizado' });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({
          severity: 'error', summary: 'No se pudo aplicar',
          detail: e?.error?.mensaje ?? 'Revise la fecha de vigencia.',
        });
      },
    });
  }
}
