import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CierreService } from '../core/services/cierre.service';
import {
  Cierre, etiquetaEstadoCierre, severidadEstadoCierre,
} from '../core/models/cierre.model';
import { ESTILOS_CONFIG } from '../core/estilos/configuracion.estilos';

@Component({
  selector: 'app-cierres-lista',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink, TableModule, ButtonModule,
    DialogModule, CalendarModule, InputNumberModule, TagModule, ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Cierre mensual</h2>
        <p class="subtitulo">
          Actualización por UFV y depreciación. Cada período se calcula, se revisa
          y recién entonces se cierra; el siguiente parte de sus valores finales.
        </p>
      </div>
      <div class="acciones">
        <p-button label="Abrir período" icon="pi pi-plus" (onClick)="abrirDialogo()" />
      </div>
    </header>

    <div class="nota nota-aviso nota-encabezado" *ngIf="pendiente() as p">
      <i class="pi pi-exclamation-circle"></i>
      <span>
        El período <strong>{{ p.etiqueta }}</strong> está {{ p.estado | lowercase }}.
        Mientras no se cierre, no se puede abrir el siguiente.
      </span>
      <a class="enlace" [routerLink]="['/activos/valuacion', p.id]">Ir al período</a>
    </div>

    <p-table [value]="cierres()" [loading]="cargando()" dataKey="id"
             styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr>
          <th style="width: 12rem">Período</th>
          <th style="width: 9rem" class="centro">Estado</th>
          <th style="width: 11rem" class="derecha">UFV</th>
          <th style="width: 8rem" class="derecha">Variación</th>
          <th style="width: 7rem" class="centro">Bienes</th>
          <th style="width: 11rem" class="derecha">Actualización</th>
          <th style="width: 11rem" class="derecha">Depreciación</th>
          <th style="width: 4rem"></th>
        </tr>
      </ng-template>

      <ng-template pTemplate="body" let-c>
        <tr>
          <td>
            <div class="periodo">{{ c.etiqueta }}</div>
            <div class="secundario" *ngIf="c.comprobante_contable">
              {{ c.comprobante_contable }}
            </div>
          </td>

          <td class="centro">
            <p-tag [value]="etiquetaEstado(c.estado)" [severity]="severidadEstado(c.estado)" />
          </td>

          <td class="derecha numero">
            <span class="secundario">{{ c.ufv_inicial | number: '1.5-5' }}</span>
            →
            {{ c.ufv_final | number: '1.5-5' }}
          </td>

          <td class="derecha numero" [class.positiva]="c.variacion_porcentual > 0">
            {{ c.variacion_porcentual | number: '1.2-4' }} %
          </td>

          <td class="centro numero">{{ c.activos_procesados ?? '—' }}</td>

          <td class="derecha numero">{{ c.total_actualizacion | number: '1.2-2' }}</td>

          <td class="derecha numero">{{ c.total_dep_financiera | number: '1.2-2' }}</td>

          <td class="centro">
            <p-button icon="pi pi-arrow-right" [text]="true" [rounded]="true" size="small"
                      [routerLink]="['/activos/valuacion', c.id]" />
          </td>
        </tr>
      </ng-template>

      <ng-template pTemplate="emptymessage">
        <tr><td colspan="8">
          <div class="vacio">
            <i class="pi pi-calendar"></i>
            <p class="titulo-vacio">Todavía no se cerró ningún período</p>
            <p-button label="Abrir el primero" icon="pi pi-plus" (onClick)="abrirDialogo()" />
          </div>
        </td></tr>
      </ng-template>
    </p-table>

    <p-dialog [(visible)]="dialogVisible" header="Abrir período" [modal]="true"
              [style]="{ width: '32rem' }" [draggable]="false">
      <div class="nota nota-aviso mb-1">
        <i class="pi pi-info-circle"></i>
        <span>
          Las UFV deben ser las <strong>publicadas por el BCB</strong> para el primer y
          último día del mes. De ellas sale el factor de actualización, y de ahí todo
          lo demás.
        </span>
      </div>

      <form [formGroup]="form" class="campos">
        <div class="campo span-6">
          <label for="periodo">Período</label>
          <p-calendar inputId="periodo" formControlName="periodo" view="month"
                      dateFormat="MM yy" [showIcon]="true" [maxDate]="hoy"
                      appendTo="body" />
        </div>

        <div class="campo span-3">
          <label for="ufvi">UFV inicial</label>
          <p-inputNumber inputId="ufvi" formControlName="ufv_inicial" mode="decimal"
                         [minFractionDigits]="5" [maxFractionDigits]="5" [min]="0.00001" />
          <small>Primer día del mes</small>
        </div>

        <div class="campo span-3">
          <label for="ufvf">UFV final</label>
          <p-inputNumber inputId="ufvf" formControlName="ufv_final" mode="decimal"
                         [minFractionDigits]="5" [maxFractionDigits]="5" [min]="0.00001" />
          <small>Último día del mes</small>
        </div>

        <div class="span-6" *ngIf="factorPrevisto() as f">
          <div class="factor">
            <span class="rotulo">Factor de actualización</span>
            <span class="valor">{{ f | number: '1.8-8' }}</span>
            <span class="variacion">
              {{ ((f - 1) * 100) | number: '1.2-4' }} % de variación
            </span>
          </div>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="dialogVisible = false" />
        <p-button label="Abrir período" icon="pi pi-check"
                  [disabled]="form.invalid || guardando()" [loading]="guardando()"
                  (onClick)="abrir()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CONFIG, `
    .periodo { font-weight: 550; text-transform: capitalize; }

    .positiva { color: #16a34a; }

    .enlace {
      margin-left: auto; font-size: 0.82rem; font-weight: 600;
      color: inherit; text-decoration: underline;
    }

    .factor {
      display: flex; flex-direction: column; gap: 0.1rem;
      padding: 0.9rem 1rem;
      background: var(--surface-ground, #f9fafb); border-radius: 8px;
    }
    .factor .rotulo {
      font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--text-color-secondary, #9ca3af);
    }
    .factor .valor {
      font-size: 1.25rem; font-weight: 650; font-variant-numeric: tabular-nums;
    }
    .factor .variacion {
      font-size: 0.8rem; color: var(--text-color-secondary, #6b7280);
    }

    .mb-1 { margin-bottom: 1rem; }
  `],
})
export class CierresListaComponent implements OnInit {
  private readonly servicio = inject(CierreService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);

  readonly cierres = signal<Cierre[]>([]);
  readonly cargando = signal(false);
  readonly guardando = signal(false);

  readonly etiquetaEstado = etiquetaEstadoCierre;
  readonly severidadEstado = severidadEstadoCierre;
  readonly hoy = new Date();

  dialogVisible = false;

  readonly form = this.fb.group({
    periodo: [null as Date | null, Validators.required],
    ufv_inicial: [null as number | null, [Validators.required, Validators.min(0.00001)]],
    ufv_final: [null as number | null, [Validators.required, Validators.min(0.00001)]],
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.listar().subscribe({
      next: (c) => { this.cierres.set(c); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  /** El período sin cerrar bloquea la apertura del siguiente. */
  pendiente(): Cierre | null {
    return this.cierres().find((c) => c.estado === 'ABIERTO' || c.estado === 'CALCULADO') ?? null;
  }

  factorPrevisto(): number | null {
    const { ufv_inicial, ufv_final } = this.form.value;
    if (!ufv_inicial || !ufv_final) return null;
    return ufv_final / ufv_inicial;
  }

  abrirDialogo(): void {
    this.form.reset();
    this.dialogVisible = true;
  }

  abrir(): void {
    const v = this.form.value;
    if (!v.periodo) return;

    this.guardando.set(true);

    const d = new Date(v.periodo);
    const periodo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

    this.servicio.abrir(periodo, v.ufv_inicial!, v.ufv_final!).subscribe({
      next: () => {
        this.guardando.set(false);
        this.dialogVisible = false;
        this.toast.add({ severity: 'success', summary: 'Período abierto' });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({
          severity: 'error', summary: 'No se pudo abrir',
          detail: e?.error?.mensaje ?? 'Revise los datos.', life: 9000,
        });
      },
    });
  }
}
