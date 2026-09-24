import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import {
  ItemDevolvible, MOTIVOS_DEVOLUCION, SalidaDevolvible,
} from '../../core/models/devolucion.models';
import { Salida } from '../../core/models/salida.models';
import { DevolucionService } from '../../core/services/devolucion.service';
import { SalidaService } from '../../core/services/salida.service';

/** Una línea en edición: el ítem devolvible más lo que el usuario escribió. */
interface LineaEdicion extends ItemDevolvible {
  cantidad: number | null;
  estado_bien: 'bueno' | 'danado';
  observaciones?: string;
}

@Component({
  selector: 'app-devolucion-form',
  standalone: true,
  imports: [
    FormsModule, DatePipe, DecimalPipe, TableModule, ButtonModule, InputTextModule,
    InputNumberModule, InputTextareaModule, DropdownModule, CalendarModule, TooltipModule,
  ],
  template: `
    <header class="pagina">
      <div>
        <h1>Registrar devolución</h1>
        <p>Toda devolución se hace contra una salida: es lo que permite valorizarla
           al costo real con que el material salió.</p>
      </div>
    </header>

    <!-- Paso 1: la salida -->
    <section class="tarjeta">
      <h2>Salida de origen</h2>

      <div class="campos">
        <label class="campo crece">
          <span>Salida</span>
          <p-dropdown [options]="salidas()" [(ngModel)]="salidaId"
                      optionLabel="numero" optionValue="id"
                      placeholder="Elija la salida a devolver"
                      [filter]="true" filterBy="numero,solicitante,unidad_solicitante"
                      [loading]="cargandoSalidas()" appendTo="body"
                      (onChange)="cargarDevolvible()">
            <ng-template let-s pTemplate="item">
              <div class="opcion-salida">
                <span class="codigo">{{ s.numero }}</span>
                <span class="tenue">
                  {{ s.unidad_solicitante }} · {{ s.fecha | date:'dd/MM/yy' }}
                </span>
              </div>
            </ng-template>
          </p-dropdown>
        </label>
      </div>

      @if (salida(); as s) {
        <div class="resumen-salida">
          <div>
            <span class="rotulo">Salida</span>
            <strong class="codigo">{{ s.salida.numero }}</strong>
          </div>
          <div>
            <span class="rotulo">Fecha</span>
            <strong>{{ s.salida.fecha | date:'dd/MM/yyyy' }}</strong>
          </div>
          <div>
            <span class="rotulo">Solicitante</span>
            <strong>{{ s.salida.solicitante ?? '—' }}</strong>
          </div>
        </div>
      }

      @if (sinDevolvible()) {
        <p class="aviso">
          <i class="pi pi-info-circle"></i>
          Esta salida ya fue devuelta por completo. No queda nada por devolver.
        </p>
      }
    </section>

    <!-- Paso 2: los ítems -->
    @if (lineas().length) {
      <section class="tarjeta">
        <h2>Qué se devuelve</h2>

        <p-table [value]="lineas()" dataKey="salida_detalle_id" styleClass="p-datatable-sm">
          <ng-template pTemplate="header">
            <tr>
              <th style="width:9rem">Código</th>
              <th>Producto</th>
              <th style="width:7rem" class="cifra">Salió</th>
              <th style="width:8rem" class="cifra">Ya devuelto</th>
              <th style="width:8rem" class="cifra">Devolvible</th>
              <th style="width:9rem" class="cifra">A devolver</th>
              <th style="width:10rem">Estado</th>
            </tr>
          </ng-template>

          <ng-template pTemplate="body" let-l>
            <tr [class.activa]="(l.cantidad ?? 0) > 0">
              <td><span class="codigo">{{ l.producto_codigo }}</span></td>
              <td>{{ l.producto_nombre }}</td>
              <td class="cifra tenue">{{ l.cantidad_salida | number:'1.0-4' }}</td>
              <td class="cifra tenue">{{ l.cantidad_devuelta | number:'1.0-4' }}</td>
              <td class="cifra"><strong>{{ l.devolvible | number:'1.0-4' }}</strong></td>
              <td>
                <p-inputNumber [(ngModel)]="l.cantidad" [min]="0" [max]="l.devolvible"
                               [minFractionDigits]="0" [maxFractionDigits]="4"
                               [showButtons]="false" styleClass="cantidad"
                               placeholder="0" />
              </td>
              <td>
                <p-dropdown [options]="estadosBien" [(ngModel)]="l.estado_bien"
                            optionLabel="etiqueta" optionValue="valor"
                            [disabled]="!l.cantidad" appendTo="body" />
              </td>
            </tr>
          </ng-template>
        </p-table>

        <p class="nota">
          Un bien marcado como dañado vuelve al almacén y descuenta del consumo del área,
          pero no se repone al stock disponible.
        </p>
      </section>

      <!-- Paso 3: datos del documento -->
      <section class="tarjeta">
        <h2>Datos de la devolución</h2>

        <div class="campos">
          <label class="campo">
            <span>Fecha</span>
            <p-calendar [(ngModel)]="fecha" dateFormat="dd/mm/yy" [showIcon]="true"
                        [maxDate]="hoy" />
          </label>

          <label class="campo crece">
            <span>Motivo</span>
            <p-dropdown [options]="motivos" [(ngModel)]="motivo" optionLabel="etiqueta"
                        optionValue="valor" placeholder="Seleccione el motivo" />
          </label>
        </div>

        <label class="campo">
          <span>Observaciones</span>
          <textarea pInputTextarea [(ngModel)]="observaciones" rows="2"
                    placeholder="Opcional: contexto que ayude a entender la devolución"></textarea>
        </label>
      </section>

      <footer class="barra-acciones">
        <div class="conteo">
          @if (itemsElegidos().length) {
            {{ itemsElegidos().length }}
            {{ itemsElegidos().length === 1 ? 'ítem' : 'ítems' }} por devolver
          } @else {
            <span class="tenue">Indique al menos una cantidad</span>
          }
        </div>

        <div class="acciones">
          <button pButton label="Cancelar" text (click)="volver()"></button>
          <button pButton label="Registrar devolución" icon="pi pi-check"
                  [disabled]="!puedeGuardar()" [loading]="guardando()"
                  (click)="guardar()"></button>
        </div>
      </footer>
    }
  `,
  styles: [`
    .tarjeta { border:1px solid var(--linea); border-radius:3px;
               padding:1rem 1.125rem; margin-bottom:1rem; }
    .tarjeta h2 { font-size:var(--t-sm); font-weight:600; margin:0 0 .875rem;
                  color:var(--tinta-suave); text-transform:uppercase;
                  letter-spacing:.04em; }

    .campos { display:flex; gap:.875rem; align-items:flex-end; flex-wrap:wrap; }
    .campo { display:flex; flex-direction:column; gap:.25rem; }
    .campo > span { font-size:var(--t-xs); color:var(--tinta-suave); }
    .crece { flex:1; min-width:14rem; }

    .opcion-salida { display:flex; flex-direction:column; gap:.0625rem; }

    .resumen-salida { display:flex; gap:2.5rem; margin-top:1rem;
                      padding-top:.875rem; border-top:1px solid var(--linea); }
    .resumen-salida > div { display:flex; flex-direction:column; gap:.125rem; }
    .rotulo { font-size:var(--t-xs); color:var(--tinta-suave); }

    .aviso { display:flex; align-items:center; gap:.5rem; margin:1rem 0 0;
             padding:.625rem .75rem; border-left:2px solid var(--aviso);
             background:var(--fondo-suave); font-size:var(--t-sm); }

    .nota { margin:.875rem 0 0; font-size:var(--t-xs); color:var(--tinta-suave); }
    .tenue { color:var(--tinta-suave); }
    tr.activa { background:var(--fondo-suave); }

    .barra-acciones { display:flex; justify-content:space-between; align-items:center;
                      padding:.875rem 0; border-top:1px solid var(--linea); }
    .conteo { font-size:var(--t-sm); }
    .acciones { display:flex; gap:.5rem; }
  `],
})
export class DevolucionFormComponent implements OnInit {
  private readonly servicio = inject(DevolucionService);
  private readonly salidaServicio = inject(SalidaService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  readonly salidas = signal<Salida[]>([]);
  readonly salida = signal<SalidaDevolvible | null>(null);
  readonly lineas = signal<LineaEdicion[]>([]);
  readonly cargandoSalidas = signal(false);
  readonly guardando = signal(false);
  readonly sinDevolvible = signal(false);

  readonly motivos = [...MOTIVOS_DEVOLUCION];
  readonly estadosBien = [
    { etiqueta: 'En buen estado', valor: 'bueno' },
    { etiqueta: 'Dañado', valor: 'danado' },
  ];

  readonly hoy = new Date();

  salidaId: number | null = null;
  fecha: Date = new Date();
  motivo = '';
  observaciones = '';

  /** Solo las líneas con cantidad. Recalcular acá evita validar en dos lados. */
  readonly itemsElegidos = computed(() =>
    this.lineas().filter(l => (l.cantidad ?? 0) > 0)
  );

  readonly puedeGuardar = computed(() =>
    this.itemsElegidos().length > 0 && this.motivo !== '' && !this.guardando()
  );

  ngOnInit(): void {
    this.cargandoSalidas.set(true);

    // Solo confirmadas: no se puede devolver lo que todavía no descargó stock.
    this.salidaServicio.listar({ estado: 'confirmada' }, 1).subscribe({
      next: res => {
        this.salidas.set(res.data);
        this.cargandoSalidas.set(false);
      },
      error: () => this.cargandoSalidas.set(false),
    });
  }

  cargarDevolvible(): void {
    if (!this.salidaId) {
      return;
    }

    this.sinDevolvible.set(false);
    this.lineas.set([]);

    this.servicio.devolvibleDe(this.salidaId).subscribe({
      next: res => {
        this.salida.set(res);
        this.sinDevolvible.set(res.items.length === 0);

        this.lineas.set(res.items.map(item => ({
          ...item,
          cantidad: null,
          estado_bien: 'bueno' as const,
        })));
      },
      error: err => {
        this.salida.set(null);
        this.lineas.set([]);

        this.mensajes.add({
          severity: 'warn',
          summary: 'No se pudo cargar la salida',
          detail: err?.error?.mensaje ?? 'Intente con otra salida.',
        });
      },
    });
  }

  guardar(): void {
    const origen = this.salida();

    if (!origen || !this.puedeGuardar()) {
      return;
    }

    this.guardando.set(true);

    this.servicio.registrar({
      salida_id: origen.salida.id,
      fecha: this.aIso(this.fecha),
      motivo: this.motivo,
      observaciones: this.observaciones || undefined,
      items: this.itemsElegidos().map(l => ({
        salida_detalle_id: l.salida_detalle_id,
        cantidad: l.cantidad!,
        estado_bien: l.estado_bien,
        observaciones: l.observaciones,
      })),
    }).subscribe({
      next: res => {
        this.mensajes.add({
          severity: 'success',
          summary: 'Devolución registrada',
          detail: res.mensaje,
        });

        this.router.navigate(['/devoluciones', res.devolucion.id]);
      },
      error: err => {
        this.guardando.set(false);

        // El backend devuelve mensajes específicos: plazo vencido, cantidad
        // mayor a la devolvible, salida no confirmada. Se muestran tal cual.
        this.mensajes.add({
          severity: 'error',
          summary: 'No se pudo registrar',
          detail: err?.error?.mensaje ?? 'Revise los datos e intente de nuevo.',
          life: 8000,
        });
      },
    });
  }

  volver(): void {
    this.router.navigate(['/devoluciones']);
  }

  /** Sin toISOString: ese convierte a UTC y en Bolivia resta un día. */
  private aIso(fecha: Date): string {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');

    return `${fecha.getFullYear()}-${mes}-${dia}`;
  }
}