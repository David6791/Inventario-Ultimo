import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { CierreService } from '../core/services/cierre.service';
import {
  Cierre, FilaConciliacion, FilaValuacion, ResumenConciliacion,
  ayudaEstadoCierre, etiquetaEstadoCierre, severidadEstadoCierre,
} from '../core/models/cierre.model';
import { ESTILOS_CONFIG } from '../core/estilos/configuracion.estilos';

@Component({
  selector: 'app-cierre-detalle',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, TabViewModule, TableModule,
    ButtonModule, DialogModule, InputTextModule, SelectButtonModule,
    TagModule, ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <ng-container *ngIf="cierre() as c">

      <header class="encabezado">
        <div>
          <button class="volver" type="button" routerLink="/activos/valuacion">
            <i class="pi pi-arrow-left"></i> Cierre mensual
          </button>
          <div class="titulo-fila">
            <h2>{{ c.etiqueta }}</h2>
            <p-tag [value]="etiquetaEstado(c.estado)" [severity]="severidadEstado(c.estado)" />
          </div>
          <p class="subtitulo">{{ ayudaEstado(c.estado) }}</p>
        </div>

        <div class="acciones">
          <p-button *ngIf="c.estado === 'ABIERTO' || c.estado === 'CALCULADO'"
                    [label]="c.estado === 'CALCULADO' ? 'Recalcular' : 'Calcular'"
                    icon="pi pi-calculator" [outlined]="c.estado === 'CALCULADO'"
                    [loading]="procesando()" (onClick)="calcular()" />

          <p-button *ngIf="c.estado === 'CALCULADO'" label="Cerrar período"
                    icon="pi pi-lock" (onClick)="dialogCerrar = true" />
        </div>
      </header>

      <!-- Resumen del período -->
      <div class="tarjetas">
        <div class="tarjeta">
          <span class="rotulo">Factor UFV</span>
          <span class="cifra">{{ c.factor | number: '1.6-6' }}</span>
          <span class="pie">
            {{ c.ufv_inicial | number: '1.5-5' }} → {{ c.ufv_final | number: '1.5-5' }}
          </span>
        </div>

        <div class="tarjeta">
          <span class="rotulo">Bienes valuados</span>
          <span class="cifra">{{ c.activos_procesados ?? '—' }}</span>
          <span class="pie">excluye bienes de control</span>
        </div>

        <div class="tarjeta">
          <span class="rotulo">Actualización</span>
          <span class="cifra">{{ c.total_actualizacion | number: '1.2-2' }}</span>
          <span class="pie">contrapartida AITB</span>
        </div>

        <div class="tarjeta">
          <span class="rotulo">Depreciación</span>
          <span class="cifra">{{ c.total_dep_financiera | number: '1.2-2' }}</span>
          <span class="pie">sobre valor actualizado</span>
        </div>
      </div>

      <div class="nota" *ngIf="c.estado === 'CALCULADO'">
        <i class="pi pi-eye"></i>
        <span>
          <strong>Todavía se puede recalcular.</strong> Revise el detalle y la conciliación
          antes de cerrar: una vez cerrado, el período no se modifica y el siguiente parte
          de estos valores.
        </span>
      </div>

      <div class="nota nota-neutra" *ngIf="c.estado === 'CERRADO'">
        <i class="pi pi-lock"></i>
        <span>
          Cerrado el {{ c.trazabilidad?.cerrado_at | date: 'dd/MM/yyyy HH:mm' }}.
          <ng-container *ngIf="c.comprobante_contable">
            Comprobante {{ c.comprobante_contable }}.
          </ng-container>
        </span>
      </div>

      <p-tabView>

        <!-- ──────────────────────────────────────────────── Auxiliar -->
        <p-tabPanel header="Auxiliar">
          <div class="barra">
            <p-selectButton [options]="tipos" optionLabel="etiqueta" optionValue="valor"
                            [(ngModel)]="tipo" (onChange)="cargarDetalle()" />
            <span class="ayuda-serie">
              {{ tipo === 'FINANCIERA'
                 ? 'Vida útil económica, para los estados financieros.'
                 : 'Vida útil del Anexo del Art. 22, para la determinación del IUE.' }}
            </span>
          </div>

          <p-table [value]="detalle()" [loading]="cargandoDetalle()" [paginator]="true"
                   [rows]="25" styleClass="p-datatable-sm tabla">
            <ng-template pTemplate="header">
              <tr>
                <th style="width: 13rem">Código</th>
                <th>Bien</th>
                <th style="width: 9rem" class="derecha">Valor inicial</th>
                <th style="width: 8rem" class="derecha">Actualiz.</th>
                <th style="width: 9rem" class="derecha">Valor final</th>
                <th style="width: 8rem" class="derecha">Dep. mes</th>
                <th style="width: 9rem" class="derecha">Dep. acum.</th>
                <th style="width: 9rem" class="derecha">Valor neto</th>
                <th style="width: 5rem" class="centro">Meses</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-f>
              <tr [class.fila-ajuste]="f.ajuste_limite < 0">
                <td><span class="codigo">{{ f.codigo }}</span></td>
                <td>
                  {{ f.denominacion }}
                  <span class="marca-ajuste" *ngIf="f.ajuste_limite < 0"
                        title="Recortado por el límite de valor recuperable (NC 3)">
                    <i class="pi pi-arrow-down"></i> límite NC 3
                  </span>
                </td>
                <td class="derecha numero">{{ f.valor_base_inicial | number: '1.2-2' }}</td>
                <td class="derecha numero">{{ f.actualizacion | number: '1.2-2' }}</td>
                <td class="derecha numero">{{ f.valor_base_final | number: '1.2-2' }}</td>
                <td class="derecha numero">{{ f.dep_periodo | number: '1.2-2' }}</td>
                <td class="derecha numero">{{ f.dep_acum_final | number: '1.2-2' }}</td>
                <td class="derecha numero fuerte">{{ f.valor_neto | number: '1.2-2' }}</td>
                <td class="centro numero">
                  {{ f.vida_util_meses ? f.meses_depreciados + '/' + f.vida_util_meses : '—' }}
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="footer">
              <tr *ngIf="detalle().length">
                <td colspan="2" class="derecha"><strong>Totales</strong></td>
                <td class="derecha numero"><strong>{{ suma('valor_base_inicial') | number: '1.2-2' }}</strong></td>
                <td class="derecha numero"><strong>{{ suma('actualizacion') | number: '1.2-2' }}</strong></td>
                <td class="derecha numero"><strong>{{ suma('valor_base_final') | number: '1.2-2' }}</strong></td>
                <td class="derecha numero"><strong>{{ suma('dep_periodo') | number: '1.2-2' }}</strong></td>
                <td class="derecha numero"><strong>{{ suma('dep_acum_final') | number: '1.2-2' }}</strong></td>
                <td class="derecha numero"><strong>{{ suma('valor_neto') | number: '1.2-2' }}</strong></td>
                <td></td>
              </tr>
            </ng-template>

            <ng-template pTemplate="emptymessage">
              <tr><td colspan="9">
                <div class="vacio">
                  <i class="pi pi-calculator"></i>
                  <p class="titulo-vacio">
                    {{ c.estado === 'ABIERTO'
                       ? 'El período todavía no se calculó'
                       : 'Sin bienes valuados en este período' }}
                  </p>
                </div>
              </td></tr>
            </ng-template>
          </p-table>
        </p-tabPanel>

        <!-- ─────────────────────────────────────────── Conciliación -->
        <p-tabPanel header="Conciliación fiscal">
          <div class="nota nota-encabezado">
            <i class="pi pi-info-circle"></i>
            <span>
              La diferencia entre la depreciación financiera y la deducible es lo que se
              ajusta en la determinación del IUE. Surge de las vidas útiles distintas y
              de la depreciación de revalúos, que <strong>no es deducible</strong>.
            </span>
          </div>

          <div class="tarjetas" *ngIf="resumenConciliacion() as r">
            <div class="tarjeta">
              <span class="rotulo">Dep. financiera</span>
              <span class="cifra">{{ r.dep_financiera | number: '1.2-2' }}</span>
            </div>
            <div class="tarjeta">
              <span class="rotulo">Dep. deducible</span>
              <span class="cifra">{{ r.dep_deducible | number: '1.2-2' }}</span>
            </div>
            <div class="tarjeta">
              <span class="rotulo">No deducible</span>
              <span class="cifra">{{ r.no_deducible | number: '1.2-2' }}</span>
              <span class="pie">de revalúos técnicos</span>
            </div>
            <div class="tarjeta" [class.resaltada]="r.diferencia !== 0">
              <span class="rotulo">Diferencia</span>
              <span class="cifra">{{ r.diferencia | number: '1.2-2' }}</span>
              <span class="pie">ajuste al IUE</span>
            </div>
          </div>

          <p-table [value]="conciliacion()" [paginator]="true" [rows]="25"
                   styleClass="p-datatable-sm tabla">
            <ng-template pTemplate="header">
              <tr>
                <th style="width: 13rem">Código</th>
                <th>Bien</th>
                <th style="width: 10rem" class="derecha">Financiera</th>
                <th style="width: 10rem" class="derecha">Impositiva</th>
                <th style="width: 10rem" class="derecha">No deducible</th>
                <th style="width: 10rem" class="derecha">Deducible</th>
                <th style="width: 10rem" class="derecha">Diferencia</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-f>
              <tr>
                <td><span class="codigo">{{ f.codigo }}</span></td>
                <td>{{ f.denominacion }}</td>
                <td class="derecha numero">{{ f.dep_financiera | number: '1.2-2' }}</td>
                <td class="derecha numero">{{ f.dep_impositiva | number: '1.2-2' }}</td>
                <td class="derecha numero">{{ f.no_deducible | number: '1.2-2' }}</td>
                <td class="derecha numero">{{ f.dep_deducible | number: '1.2-2' }}</td>
                <td class="derecha numero" [class.con-diferencia]="f.diferencia !== 0">
                  {{ f.diferencia | number: '1.2-2' }}
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="emptymessage">
              <tr><td colspan="7">
                <div class="vacio">
                  <i class="pi pi-equals"></i>
                  <p class="titulo-vacio">Sin datos para conciliar</p>
                </div>
              </td></tr>
            </ng-template>
          </p-table>
        </p-tabPanel>
      </p-tabView>

      <!-- Diálogo de cierre -->
      <p-dialog [(visible)]="dialogCerrar" header="Cerrar período" [modal]="true"
                [style]="{ width: '30rem' }" [draggable]="false">
        <div class="nota nota-aviso mb-1">
          <i class="pi pi-exclamation-triangle"></i>
          <span>
            Después de cerrar, el período <strong>no se modifica</strong> y el siguiente
            parte de estos valores. Reabrirlo exigiría revertir los asientos contables.
          </span>
        </div>

        <label class="etiqueta-campo" for="comprobante">Comprobante contable</label>
        <input id="comprobante" pInputText [(ngModel)]="comprobante" class="w-full"
               placeholder="Opcional — ej. CI-2026-03" />

        <ng-template pTemplate="footer">
          <p-button label="Cancelar" [text]="true" (onClick)="dialogCerrar = false" />
          <p-button label="Cerrar período" icon="pi pi-lock" [loading]="procesando()"
                    (onClick)="cerrar()" />
        </ng-template>
      </p-dialog>
    </ng-container>
  `,
  styles: [ESTILOS_CONFIG, `
    .volver {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0; margin-bottom: 0.5rem; font-size: 0.82rem;
      color: var(--text-color-secondary, #6b7280);
      background: none; border: none; cursor: pointer;
    }

    .titulo-fila { display: flex; align-items: center; gap: 0.6rem; }
    .titulo-fila h2 { margin: 0; text-transform: capitalize; }

    .tarjetas {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem;
      margin-bottom: 1.25rem;
    }
    @media (max-width: 900px) { .tarjetas { grid-template-columns: repeat(2, 1fr); } }

    .tarjeta {
      display: flex; flex-direction: column; gap: 0.15rem;
      padding: 0.9rem 1rem;
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #e5e7eb);
      border-radius: 10px;
    }
    .tarjeta.resaltada { border-color: #f59e0b; background: #fffbeb; }

    .tarjeta .rotulo {
      font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--text-color-secondary, #9ca3af);
    }
    .tarjeta .cifra {
      font-size: 1.35rem; font-weight: 650;
      font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
    }
    .tarjeta .pie {
      font-size: 0.72rem; color: var(--text-color-secondary, #9ca3af);
    }

    .nota { margin-bottom: 1.25rem; }

    .ayuda-serie {
      font-size: 0.8rem; color: var(--text-color-secondary, #6b7280);
    }

    .fila-ajuste { background: #fffbf5; }

    .marca-ajuste {
      display: inline-flex; align-items: center; gap: 0.25rem;
      margin-left: 0.5rem; font-size: 0.7rem; font-weight: 600;
      color: #b45309;
    }

    .fuerte { font-weight: 600; }
    .con-diferencia { color: #b45309; font-weight: 600; }

    .etiqueta-campo {
      display: block; margin-bottom: 0.35rem;
      font-size: 0.8rem; font-weight: 550;
    }
    .w-full { width: 100%; }
    .mb-1 { margin-bottom: 1rem; }
  `],
})
export class CierreDetalleComponent implements OnInit {
  private readonly servicio = inject(CierreService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly toast = inject(MessageService);

  readonly cierre = signal<Cierre | null>(null);
  readonly detalle = signal<FilaValuacion[]>([]);
  readonly conciliacion = signal<FilaConciliacion[]>([]);
  readonly resumenConciliacion = signal<ResumenConciliacion | null>(null);
  readonly cargandoDetalle = signal(false);
  readonly procesando = signal(false);

  readonly etiquetaEstado = etiquetaEstadoCierre;
  readonly severidadEstado = severidadEstadoCierre;
  readonly ayudaEstado = ayudaEstadoCierre;

  readonly tipos = [
    { valor: 'FINANCIERA', etiqueta: 'Financiera' },
    { valor: 'IMPOSITIVA', etiqueta: 'Impositiva' },
  ];

  tipo: 'FINANCIERA' | 'IMPOSITIVA' = 'FINANCIERA';
  dialogCerrar = false;
  comprobante = '';

  private id!: number;

  ngOnInit(): void {
    this.id = Number(this.ruta.snapshot.paramMap.get('id'));
    this.cargar();
  }

  private cargar(): void {
    this.servicio.ver(this.id).subscribe((c) => {
      this.cierre.set(c);

      if (c.estado !== 'ABIERTO') {
        this.cargarDetalle();
        this.cargarConciliacion();
      }
    });
  }

  cargarDetalle(): void {
    this.cargandoDetalle.set(true);

    this.servicio.detalle(this.id, this.tipo).subscribe({
      next: (d) => { this.detalle.set(d); this.cargandoDetalle.set(false); },
      error: () => this.cargandoDetalle.set(false),
    });
  }

  private cargarConciliacion(): void {
    this.servicio.conciliacion(this.id).subscribe({
      next: (r) => {
        this.conciliacion.set(r.data);
        this.resumenConciliacion.set(r.resumen);
      },
    });
  }

  suma(campo: keyof FilaValuacion): number {
    return this.detalle().reduce((t, f) => t + (Number(f[campo]) || 0), 0);
  }

  calcular(): void {
    this.procesando.set(true);

    this.servicio.calcular(this.id).subscribe({
      next: (r) => {
        this.procesando.set(false);
        this.cierre.set(r.data);
        this.toast.add({ severity: 'success', summary: r.mensaje, life: 6000 });
        this.cargarDetalle();
        this.cargarConciliacion();
      },
      error: (e) => {
        this.procesando.set(false);
        this.toast.add({
          severity: 'error', summary: 'No se pudo calcular',
          detail: e?.error?.mensaje ?? '', life: 10000,
        });
      },
    });
  }

  cerrar(): void {
    this.procesando.set(true);

    this.servicio.cerrar(this.id, this.comprobante || undefined).subscribe({
      next: (r) => {
        this.procesando.set(false);
        this.dialogCerrar = false;
        this.cierre.set(r.data);
        this.toast.add({ severity: 'success', summary: r.mensaje, life: 6000 });
      },
      error: (e) => {
        this.procesando.set(false);
        this.toast.add({
          severity: 'error', summary: 'No se pudo cerrar',
          detail: e?.error?.mensaje ?? '', life: 9000,
        });
      },
    });
  }
}
