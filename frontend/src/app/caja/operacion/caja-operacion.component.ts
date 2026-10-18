import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { mensajeDeError } from '../../cargas/core/errores';
import { PermisosService } from '../../core/services/permisos.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import {
  CajaOperacion, DatosMovimiento, Moneda, Movimiento, OpcionesCaja, PersonaCorta, SaldoSesion, TipoMovimiento, UsuarioCorto,
} from '../core/caja.model';
import { CajaService } from '../core/caja.service';
import { DineroPipe, formatoDinero, simbolo } from '../core/dinero';
import { ESTILOS_CAJA } from '../core/estilos';

/**
 * Operación de una caja: apertura, saldo del momento por moneda, registro de
 * ingresos y egresos, anulación e impresión del comprobante.
 *
 * Las reglas (saldo que no queda negativo, saldo inicial que sale del cierre
 * anterior, numeración) las aplica la base; la pantalla las anticipa para
 * avisar antes, pero el mensaje que manda es el de la base.
 */
@Component({
  selector: 'app-caja-operacion',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterLink, AutoCompleteModule, ButtonModule, DialogModule, DropdownModule,
    InputNumberModule, InputTextModule, InputTextareaModule, SelectButtonModule, TableModule, ToastModule,
    TooltipModule, DineroPipe, TienePermisoDirective,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <a routerLink="/caja/operar" class="volver"><i class="pi pi-arrow-left"></i> Cajas</a>

    <ng-container *ngIf="caja() as c">
      <header class="encabezado">
        <div>
          <h2>{{ c.nombre }} <span class="codigo titulo-codigo">{{ c.codigo }}</span></h2>
          <p class="subtitulo" *ngIf="c.sesion_abierta as s">
            Sesión {{ s.numero }} abierta por {{ s.abierta_por }} el {{ s.abierta_en | date: 'dd/MM/yyyy HH:mm' }} · {{ c.almacen?.nombre }}
          </p>
          <p class="subtitulo" *ngIf="!c.sesion_abierta">Caja cerrada · {{ c.almacen?.nombre }}</p>
        </div>
        <div class="acciones" *ngIf="c.sesion_abierta && c.soy_cajero">
          <ng-container *appTienePermiso="'caja.registrar'">
            <p-button label="Ingreso" icon="pi pi-arrow-down-left" severity="success" [outlined]="true"
                      (onClick)="nuevoMovimiento('INGRESO')" />
            <p-button label="Egreso" icon="pi pi-arrow-up-right" severity="danger" [outlined]="true"
                      (onClick)="nuevoMovimiento('EGRESO')" />
          </ng-container>
        </div>
      </header>

      <div class="nota nota-neutra nota-encabezado" *ngIf="!c.soy_cajero">
        <i class="pi pi-eye"></i>
        <span>Solo consulta: no está asignado como cajero de esta caja.
              Cajeros: {{ nombresCajeros() || 'ninguno todavía' }}.</span>
      </div>

      <!-- ===================== Caja cerrada: apertura ===================== -->
      <section class="apertura" *ngIf="!c.sesion_abierta && c.soy_cajero">
        <div class="icono"><i class="pi pi-lock"></i></div>
        <div class="contenido">
          <h3>Abrir la caja</h3>
          <p *ngIf="c.ultima_cerrada as u" class="secundario">
            Último cierre: sesión {{ u.numero }}, {{ u.cerrada_en | date: 'dd/MM/yyyy HH:mm' }} por {{ u.cerrada_por }}.
          </p>

          <div class="monedas">
            <div class="moneda" *ngFor="let m of monedas()">
              <ng-container *ngIf="c.saldos_arranque[m] !== null && c.saldos_arranque[m] !== undefined; else digitar">
                <span class="rotulo">Arranca con</span>
                <span class="monto grande">{{ c.saldos_arranque[m] | dinero: m }}</span>
                <small class="secundario">Lo contado en el último cierre.</small>
              </ng-container>
              <ng-template #digitar>
                <label class="rotulo" [for]="'inicial-' + m">Efectivo inicial {{ m === 'USD' ? 'en dólares' : 'en bolivianos' }}</label>
                <p-inputNumber [inputId]="'inicial-' + m" [(ngModel)]="saldoInicial[m]" mode="decimal" locale="es-BO"
                               [minFractionDigits]="2" [maxFractionDigits]="2" [min]="0" [prefix]="simbolo(m) + ' '" />
                <small class="secundario">Primera apertura{{ m === 'USD' ? ' en dólares' : '' }}: cuente lo que hay en caja.</small>
              </ng-template>
            </div>
          </div>

          <p-button *appTienePermiso="'caja.abrir'" label="Abrir caja" icon="pi pi-lock-open"
                    [loading]="abriendo()" [disabled]="!aperturaLista()" (onClick)="abrir()" />
          <p class="secundario" *ngIf="!puede('caja.abrir')">Su usuario no tiene permiso para abrir la caja.</p>
        </div>
      </section>

      <!-- ====================== Caja abierta ====================== -->
      <ng-container *ngIf="c.sesion_abierta as s">
        <section class="saldos">
          <article class="saldo" *ngFor="let saldo of s.saldos">
            <span class="rotulo">Efectivo en caja · {{ saldo.moneda === 'USD' ? 'dólares' : 'bolivianos' }}</span>
            <span class="monto principal">{{ saldo.saldo_efectivo_actual | dinero: saldo.moneda }}</span>
            <dl class="desglose">
              <div><dt>Inicial</dt><dd class="monto">{{ saldo.saldo_inicial | dinero }}</dd></div>
              <div><dt>Ingresos</dt><dd class="monto ingreso">+ {{ saldo.ingresos_efectivo | dinero }}</dd></div>
              <div><dt>Egresos</dt><dd class="monto egreso">− {{ saldo.egresos_efectivo | dinero }}</dd></div>
            </dl>
            <div class="otras" *ngIf="+saldo.ingresos_no_efectivo || +saldo.egresos_no_efectivo">
              Cheques y transferencias (no cuentan en el efectivo):
              <span class="monto ingreso">+ {{ saldo.ingresos_no_efectivo | dinero }}</span> ·
              <span class="monto egreso">− {{ saldo.egresos_no_efectivo | dinero }}</span>
            </div>
          </article>
        </section>

        <div class="nota nota-neutra nota-encabezado ultimo" *ngIf="ultimo() as u">
          <i class="pi pi-check-circle"></i>
          <span>Comprobante <strong class="codigo">{{ u.numero }}</strong> registrado:
                {{ u.concepto?.nombre }}, {{ u.monto | dinero: u.moneda }}.</span>
          <p-button label="Imprimir" icon="pi pi-print" size="small" [text]="true" (onClick)="imprimir(u)" />
        </div>

        <p-table [value]="s.movimientos ?? []" dataKey="id" styleClass="p-datatable-sm tabla"
                 [rowTrackBy]="porId">
          <ng-template pTemplate="caption">
            <div class="titulo-tabla">Movimientos de la sesión <span class="contador">({{ s.movimientos?.length ?? 0 }})</span></div>
          </ng-template>
          <ng-template pTemplate="header">
            <tr>
              <th style="width: 11rem">Comprobante</th>
              <th>Concepto y glosa</th>
              <th style="width: 14rem">Persona</th>
              <th style="width: 9rem">Forma de pago</th>
              <th style="width: 10rem" class="derecha">Monto</th>
              <th style="width: 6rem"></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-m>
            <tr [class.anulado]="m.estado === 'ANULADO'">
              <td>
                <div class="codigo">{{ m.numero }}</div>
                <div class="secundario">{{ m.fecha | date: 'HH:mm' }} · {{ nombreDe(m.registrado_por) }}</div>
              </td>
              <td>
                <div>
                  {{ m.concepto?.nombre }}
                  <span class="pastilla pastilla-aviso" *ngIf="m.estado === 'ANULADO'"
                        [pTooltip]="'Anulado por ' + nombreDe(m.anulado_por) + ': ' + m.motivo_anulacion">Anulado</span>
                </div>
                <div class="secundario">{{ m.glosa }}</div>
              </td>
              <td>
                <a *ngIf="m.persona_id; else sinFicha" class="persona" [routerLink]="['/caja/personas']"
                   [queryParams]="{ ver: m.persona_id }">{{ m.persona_nombre }}</a>
                <ng-template #sinFicha><div>{{ m.persona_nombre }}</div></ng-template>
                <div class="secundario" *ngIf="m.persona_ci">CI {{ m.persona_ci }}</div>
              </td>
              <td>
                <div>{{ etiquetaForma(m.forma_pago) }}</div>
                <div class="secundario" *ngIf="m.banco">{{ m.banco.nombre }} · {{ m.nro_documento }}</div>
              </td>
              <td class="derecha">
                <span class="monto" [class.ingreso]="m.tipo === 'INGRESO'" [class.egreso]="m.tipo === 'EGRESO'">
                  {{ m.tipo === 'INGRESO' ? '+' : '−' }} {{ m.monto | dinero: m.moneda }}
                </span>
              </td>
              <td class="centro">
                <p-button icon="pi pi-print" [text]="true" [rounded]="true" size="small" pTooltip="Imprimir comprobante"
                          (onClick)="imprimir(m)" />
                <ng-container *ngIf="m.estado === 'VIGENTE' && m.concepto?.origen === 'MANUAL' && c.soy_cajero">
                  <p-button *appTienePermiso="'caja.anular'" icon="pi pi-ban" [text]="true" [rounded]="true" size="small"
                            severity="danger" pTooltip="Anular" (onClick)="pedirAnulacion(m)" />
                </ng-container>
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr><td colspan="6">
              <div class="vacio">
                <i class="pi pi-inbox"></i>
                <div class="titulo-vacio">Sin movimientos todavía</div>
                <span>Registre un ingreso o un egreso con los botones de arriba.</span>
              </div>
            </td></tr>
          </ng-template>
        </p-table>
      </ng-container>
    </ng-container>

    <!-- ====================== Registrar movimiento ====================== -->
    <p-dialog [(visible)]="movimientoVisible" [header]="tipoNuevo() === 'INGRESO' ? 'Registrar ingreso' : 'Registrar egreso'"
              [modal]="true" [style]="{ width: '40rem' }" [draggable]="false">
      <form [formGroup]="form" class="campos">
        <div class="campo span-6">
          <label for="concepto">Concepto</label>
          <p-dropdown inputId="concepto" formControlName="concepto_id" [options]="conceptosDelTipo()" optionLabel="nombre"
                      optionValue="id" placeholder="Seleccione" [filter]="true" filterBy="nombre" appendTo="body"
                      emptyMessage="No hay conceptos" />
          <small *ngIf="opciones() && !conceptosDelTipo().length" class="alerta">
            No hay conceptos de {{ tipoNuevo() === 'INGRESO' ? 'ingreso' : 'egreso' }} activos.
            Créelos en Caja → Conceptos.
          </small>
        </div>

        <div class="campo span-3">
          <label for="monto">Monto</label>
          <p-inputNumber inputId="monto" formControlName="monto" mode="decimal" locale="es-BO" [minFractionDigits]="2"
                         [maxFractionDigits]="2" [min]="0" [prefix]="simbolo(form.value.moneda ?? 'BOB') + ' '" />
          <small *ngIf="disponible() as d" [class.alerta]="excede()">
            {{ excede() ? 'Supera el efectivo en caja:' : 'Efectivo disponible:' }} {{ d }}
          </small>
        </div>
        <div class="campo span-3" *ngIf="monedas().length > 1">
          <label>Moneda</label>
          <p-selectButton formControlName="moneda" [options]="opcionesMoneda" optionLabel="etiqueta" optionValue="valor" />
        </div>

        <div class="campo span-6">
          <label>Forma de pago</label>
          <p-selectButton formControlName="forma_pago" [options]="opciones()?.formas_pago ?? []" optionLabel="etiqueta"
                          optionValue="valor" />
          <small *ngIf="form.value.forma_pago !== 'EFECTIVO'">Se registra para el libro de caja, pero no mueve el efectivo.</small>
        </div>

        <ng-container *ngIf="form.value.forma_pago !== 'EFECTIVO'">
          <div class="campo span-3">
            <label for="banco">Banco</label>
            <p-dropdown inputId="banco" formControlName="banco_id" [options]="opciones()?.bancos ?? []" optionLabel="nombre"
                        optionValue="id" placeholder="Seleccione" appendTo="body" />
          </div>
          <div class="campo span-3">
            <label for="documento">N.º de {{ form.value.forma_pago === 'CHEQUE' ? 'cheque' : 'transferencia' }}</label>
            <input id="documento" pInputText formControlName="nro_documento" maxlength="40" />
          </div>
        </ng-container>

        <div class="campo span-4">
          <label for="persona">{{ tipoNuevo() === 'INGRESO' ? 'Recibido de' : 'Pagado a' }}</label>
          <p-autoComplete inputId="persona" [(ngModel)]="personaTexto" [ngModelOptions]="{ standalone: true }"
                          [suggestions]="sugerencias()" (completeMethod)="buscarPersona($event.query)"
                          (ngModelChange)="escribirPersona($event)" field="nombre" [minLength]="2" [delay]="250"
                          [forceSelection]="false" appendTo="body" placeholder="Nombre o CI" (onBlur)="revisarPersona()" [inputStyle]="{ width: '100%' }"
                          styleClass="w-full">
            <ng-template let-p pTemplate="item">
              <div class="sugerencia"><span>{{ p.nombre }}</span><span class="secundario">{{ p.ci ? 'CI ' + p.ci : 'sin CI' }}</span></div>
            </ng-template>
          </p-autoComplete>
          <small *ngIf="form.value.persona_id">Del registro de personas.</small>
          <small *ngIf="!form.value.persona_id && form.value.persona_nombre">Persona nueva: se agrega al registro al guardar.</small>
        </div>
        <div class="campo span-2">
          <label for="ci">CI o NIT <span class="opcional">(opcional)</span></label>
          <input id="ci" pInputText formControlName="persona_ci" maxlength="15" (blur)="revisarPersona()" />
        </div>

        <div class="campo span-6" *ngIf="!form.value.persona_id && (parecidas().length || ciAjeno())">
          <div class="nota nota-aviso">
            <i class="pi pi-exclamation-triangle"></i>
            <div class="aviso-persona">
              <ng-container *ngIf="ciAjeno() as p">
                <span>El CI {{ p.ci }} ya está registrado a nombre de <strong>{{ p.nombre }}</strong>:
                      el movimiento quedará a su nombre.</span>
                <p-button label="Usar a {{ p.nombre }}" size="small" [text]="true" (onClick)="usarPersona(p)" />
              </ng-container>
              <ng-container *ngFor="let p of parecidas()">
                <span>Ya está registrado <strong>{{ p.nombre }}</strong> {{ p.ci ? 'con CI ' + p.ci : 'sin CI' }}.
                      Si es la misma persona, elíjala para no duplicarla.</span>
                <p-button label="Es la misma persona" size="small" [text]="true" (onClick)="usarPersona(p)" />
              </ng-container>
            </div>
          </div>
        </div>

        <div class="campo span-6">
          <label for="glosa">Glosa</label>
          <textarea id="glosa" pInputTextarea formControlName="glosa" rows="2" maxlength="250"
                    placeholder="Qué se pagó o por qué ingresa el dinero"></textarea>
        </div>
      </form>

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="movimientoVisible = false" />
        <p-button [label]="tipoNuevo() === 'INGRESO' ? 'Registrar ingreso' : 'Registrar egreso'" icon="pi pi-check"
                  [severity]="tipoNuevo() === 'INGRESO' ? 'success' : 'danger'"
                  [loading]="guardando()" [disabled]="form.invalid || excede() || guardando()" (onClick)="registrar()" />
      </ng-template>
    </p-dialog>

    <!-- ====================== Anular ====================== -->
    <p-dialog [(visible)]="anularVisible" header="Anular comprobante" [modal]="true" [style]="{ width: '32rem' }"
              [draggable]="false">
      <ng-container *ngIf="aAnular() as m">
        <p class="explicacion">
          Se anula el comprobante <strong class="codigo">{{ m.numero }}</strong> ({{ m.concepto?.nombre }},
          {{ m.monto | dinero: m.moneda }}). No se borra: queda en la lista marcado como anulado
          {{ m.forma_pago === 'EFECTIVO' ? 'y el monto vuelve al saldo' : '' }}.
        </p>
        <div class="campos">
          <div class="campo span-6">
            <label for="motivo">Motivo</label>
            <textarea id="motivo" pInputTextarea [(ngModel)]="motivo" rows="3" maxlength="250"></textarea>
            <small>Al menos 10 caracteres. Sale impreso en el comprobante anulado.</small>
          </div>
        </div>
      </ng-container>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="anularVisible = false" />
        <p-button label="Anular" icon="pi pi-ban" severity="danger" [loading]="anulando()"
                  [disabled]="motivo.trim().length < 10 || anulando()" (onClick)="anular()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [...ESTILOS_CAJA, `
    .volver { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; margin-bottom: 0.6rem;
              color: var(--text-color-secondary, #6b7280); text-decoration: none; }
    .volver:hover { color: var(--primary-color, #2563eb); }
    .titulo-codigo { font-size: 0.85rem; font-weight: 600; margin-left: 0.4rem; vertical-align: middle;
                     padding: 0.1rem 0.4rem; border-radius: 4px; background: var(--surface-ground, #f3f4f6); }

    .apertura { display: flex; gap: 1.25rem; padding: 1.5rem; border: 1px dashed var(--surface-border, #d1d5db);
                border-radius: 10px; max-width: 46rem; }
    .apertura .icono { flex: none; width: 2.75rem; height: 2.75rem; border-radius: 50%; display: flex;
                       align-items: center; justify-content: center; background: #fef3c7; color: #92400e; }
    .apertura h3 { margin: 0 0 0.25rem; font-size: 1.05rem; }
    .apertura .contenido { flex: 1; display: flex; flex-direction: column; gap: 0.8rem; align-items: flex-start; }
    .monedas { display: flex; flex-wrap: wrap; gap: 1.5rem; }
    .moneda { display: flex; flex-direction: column; gap: 0.3rem; min-width: 14rem; }

    .rotulo { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-color-secondary, #6b7280); }
    .monto.grande { font-size: 1.4rem; font-weight: 700; }

    .saldos { display: grid; grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
    .saldo { padding: 1rem 1.2rem; border-radius: 10px; border: 1px solid var(--surface-border, #e5e7eb);
             background: var(--surface-card, #fff); display: flex; flex-direction: column; gap: 0.35rem; }
    .monto.principal { font-size: 1.9rem; font-weight: 700; letter-spacing: -0.02em; }
    .desglose { display: flex; gap: 1.5rem; margin: 0.2rem 0 0; }
    .desglose div { display: flex; flex-direction: column; }
    .desglose dt { font-size: 0.72rem; color: var(--text-color-secondary, #6b7280); }
    .desglose dd { margin: 0; font-size: 0.9rem; }
    .otras { font-size: 0.78rem; color: var(--text-color-secondary, #6b7280); border-top: 1px solid var(--surface-border, #e5e7eb);
             padding-top: 0.45rem; margin-top: 0.2rem; }

    .ultimo { align-items: center; }
    .titulo-tabla { font-weight: 600; font-size: 0.95rem; }
    tr.anulado td { color: var(--text-color-secondary, #9ca3af); }
    tr.anulado .monto { text-decoration: line-through; }
    .persona { color: inherit; text-decoration: none; border-bottom: 1px dotted currentColor; }
    .persona:hover { color: var(--primary-color, #2563eb); }
    .aviso-persona { display: flex; flex-direction: column; gap: 0.15rem; align-items: flex-start; font-size: 0.85rem; }
    .sugerencia { display: flex; justify-content: space-between; gap: 1rem; width: 100%; }
    :host ::ng-deep .w-full, :host ::ng-deep .w-full input { width: 100%; }
    .alerta { color: #b91c1c !important; font-weight: 600; }
    .opcional { font-weight: 400; color: var(--text-color-secondary, #9ca3af); }
    .explicacion { font-size: 0.88rem; line-height: 1.5; margin-top: 0; }
  `],
})
export class CajaOperacionComponent implements OnInit {
  /** :id de la ruta (withComponentInputBinding). */
  readonly id = input.required<string>();

  private readonly servicio = inject(CajaService);
  private readonly permisos = inject(PermisosService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);

  readonly caja = signal<CajaOperacion | null>(null);
  readonly opciones = signal<OpcionesCaja | null>(null);
  readonly abriendo = signal(false);
  readonly guardando = signal(false);
  readonly anulando = signal(false);
  readonly tipoNuevo = signal<TipoMovimiento>('EGRESO');
  readonly ultimo = signal<Movimiento | null>(null);
  readonly aAnular = signal<Movimiento | null>(null);

  movimientoVisible = false;
  anularVisible = false;
  motivo = '';
  saldoInicial: Partial<Record<Moneda, number | null>> = {};

  readonly simbolo = simbolo;
  readonly sugerencias = signal<PersonaCorta[]>([]);
  /** Mismo nombre con otro CI (o sin CI): posible duplicado. */
  readonly parecidas = signal<PersonaCorta[]>([]);
  /** El CI escrito ya es de otra persona. */
  readonly ciAjeno = signal<PersonaCorta | null>(null);
  /** Lo que muestra el autocompletado: texto escrito o la persona elegida. */
  personaTexto: string | PersonaCorta | null = null;
  readonly opcionesMoneda = [
    { valor: 'BOB', etiqueta: 'Bolivianos' },
    { valor: 'USD', etiqueta: 'Dólares' },
  ];

  readonly monedas = computed<Moneda[]>(() => (this.caja()?.maneja_usd ? ['BOB', 'USD'] : ['BOB']));

  readonly form = this.fb.group({
    concepto_id: [null as number | null, Validators.required],
    monto: [null as number | null, [Validators.required, Validators.min(0.01)]],
    moneda: ['BOB' as Moneda, Validators.required],
    forma_pago: ['EFECTIVO', Validators.required],
    banco_id: [null as number | null],
    nro_documento: [null as string | null],
    persona_id: [null as number | null],
    persona_nombre: ['', [Validators.required, Validators.maxLength(150)]],
    persona_ci: [null as string | null],
    glosa: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(250)]],
  });

  /** Valor del formulario como señal, para que los avisos de saldo se recalculen al escribir. */
  private readonly valores = signal(this.form.getRawValue());

  readonly conceptosDelTipo = computed(() =>
    (this.opciones()?.conceptos ?? []).filter((c) => c.tipo === this.tipoNuevo()));

  private saldoDe(moneda: string): SaldoSesion | undefined {
    return this.caja()?.sesion_abierta?.saldos.find((s) => s.moneda === moneda);
  }

  /** Efectivo disponible, solo para egresos en efectivo. */
  readonly disponible = computed(() => {
    const v = this.valores();
    if (this.tipoNuevo() !== 'EGRESO' || v.forma_pago !== 'EFECTIVO') return null;
    const saldo = this.saldoDe(v.moneda ?? 'BOB');
    return saldo ? `${simbolo(saldo.moneda)} ${formatoDinero(saldo.saldo_efectivo_actual)}` : null;
  });

  readonly excede = computed(() => {
    const v = this.valores();
    if (this.tipoNuevo() !== 'EGRESO' || v.forma_pago !== 'EFECTIVO' || !v.monto) return false;
    const saldo = this.saldoDe(v.moneda ?? 'BOB');
    return !!saldo && Number(v.monto) > Number(saldo.saldo_efectivo_actual);
  });

  ngOnInit(): void {
    this.servicio.opciones().subscribe((o) => this.opciones.set(o));
    this.form.valueChanges.subscribe(() => this.valores.set(this.form.getRawValue()));

    // Banco y número solo cuando no es efectivo.
    this.form.get('forma_pago')!.valueChanges.subscribe((f) => {
      const banco = this.form.get('banco_id')!;
      const documento = this.form.get('nro_documento')!;
      if (f === 'EFECTIVO') {
        banco.clearValidators(); documento.clearValidators();
        banco.setValue(null, { emitEvent: false }); documento.setValue(null, { emitEvent: false });
      } else {
        banco.setValidators(Validators.required); documento.setValidators(Validators.required);
      }
      banco.updateValueAndValidity({ emitEvent: false });
      documento.updateValueAndValidity({ emitEvent: false });
    });

    this.cargar();
  }

  cargar(): void {
    this.servicio.ver(Number(this.id())).subscribe({
      next: (c) => {
        this.caja.set(c);
        this.saldoInicial = {};
        for (const m of (c.maneja_usd ? ['BOB', 'USD'] : ['BOB']) as Moneda[]) {
          if (c.saldos_arranque[m] === null || c.saldos_arranque[m] === undefined) this.saldoInicial[m] = null;
        }
      },
      error: (e) => this.toast.add({ severity: 'error', summary: 'No se pudo cargar la caja', detail: mensajeDeError(e), life: 10000 }),
    });
  }

  puede(permiso: string): boolean {
    return this.permisos.can(permiso);
  }

  porId(_: number, m: Movimiento): number {
    return m.id;
  }

  nombreDe(usuario: UsuarioCorto | number | null): string {
    return usuario && typeof usuario === 'object' ? usuario.name : '';
  }

  etiquetaForma(forma: string): string {
    return this.opciones()?.formas_pago.find((f) => f.valor === forma)?.etiqueta ?? forma;
  }

  // ------------------------------------------------------------ Apertura

  /** Lista cuando cada moneda que se digita tiene un monto (cero vale). */
  aperturaLista(): boolean {
    return Object.values(this.saldoInicial).every((v) => v !== null && v !== undefined);
  }

  abrir(): void {
    const c = this.caja();
    if (!c) return;
    this.abriendo.set(true);
    this.servicio.abrir(c.id, this.saldoInicial).subscribe({
      next: (r) => {
        this.abriendo.set(false);
        this.toast.add({ severity: 'success', summary: r.mensaje ?? 'Caja abierta' });
        this.cargar();
      },
      error: (e) => {
        this.abriendo.set(false);
        this.toast.add({ severity: 'error', summary: 'No se abrió la caja', detail: mensajeDeError(e), life: 8000 });
        this.cargar();
      },
    });
  }

  // --------------------------------------------------------- Movimientos

  nuevoMovimiento(tipo: TipoMovimiento): void {
    this.tipoNuevo.set(tipo);
    this.form.reset({ moneda: 'BOB', forma_pago: 'EFECTIVO' });
    this.form.get('persona_ci')!.enable();
    this.personaTexto = null;
    this.parecidas.set([]);
    this.ciAjeno.set(null);
    this.movimientoVisible = true;

    // Se vuelven a pedir los conceptos: pudieron crearse después de abrir la pantalla.
    this.servicio.opciones().subscribe((o) => {
      this.opciones.set(o);
      const conceptos = this.conceptosDelTipo();
      if (conceptos.length === 1) this.form.patchValue({ concepto_id: conceptos[0].id });
    });
  }

  nombresCajeros(): string {
    return (this.caja()?.cajeros ?? []).map((u) => u.name).join(', ');
  }

  buscarPersona(texto: string): void {
    this.servicio.buscarPersonas(texto).subscribe({
      next: (p) => this.sugerencias.set(p),
      error: () => this.sugerencias.set([]),
    });
  }

  /** Elegida de la lista: queda vinculada. Escrita a mano: será una persona nueva (o la del mismo CI). */
  escribirPersona(valor: string | PersonaCorta | null): void {
    const ci = this.form.get('persona_ci')!;
    if (valor && typeof valor === 'object') {
      this.form.patchValue({ persona_id: valor.id, persona_nombre: valor.nombre, persona_ci: valor.ci });
      ci.disable();
      this.parecidas.set([]);
      this.ciAjeno.set(null);
    } else {
      if (this.form.value.persona_id) ci.setValue(null);
      this.form.patchValue({ persona_id: null, persona_nombre: (valor ?? '').toString() });
      ci.enable();
    }
  }

  /** Antes de guardar una persona nueva, mira si ya existe con otro CI o si el CI es de otra. */
  revisarPersona(): void {
    const v = this.form.getRawValue();
    if (v.persona_id || !v.persona_nombre?.trim()) {
      this.parecidas.set([]); this.ciAjeno.set(null);
      return;
    }
    this.servicio.coincidencias(v.persona_nombre, v.persona_ci).subscribe({
      next: (r) => { this.parecidas.set(r.mismo_nombre); this.ciAjeno.set(r.mismo_ci); },
      error: () => { this.parecidas.set([]); this.ciAjeno.set(null); },
    });
  }

  usarPersona(p: PersonaCorta): void {
    this.personaTexto = p;
    this.escribirPersona(p);
    this.parecidas.set([]);
    this.ciAjeno.set(null);
  }

  registrar(): void {
    const sesion = this.caja()?.sesion_abierta;
    if (!sesion) return;

    this.guardando.set(true);
    this.servicio.registrar(sesion.id, this.form.getRawValue() as DatosMovimiento).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.movimientoVisible = false;
        this.ultimo.set(r.data);
        this.toast.add({ severity: 'success', summary: r.mensaje ?? 'Registrado' });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se registró', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }

  pedirAnulacion(m: Movimiento): void {
    this.aAnular.set(m);
    this.motivo = '';
    this.anularVisible = true;
  }

  anular(): void {
    const m = this.aAnular();
    if (!m) return;

    this.anulando.set(true);
    this.servicio.anular(m.id, this.motivo.trim()).subscribe({
      next: (r) => {
        this.anulando.set(false);
        this.anularVisible = false;
        if (this.ultimo()?.id === m.id) this.ultimo.set(null);
        this.toast.add({ severity: 'success', summary: r.mensaje ?? 'Anulado' });
        this.cargar();
      },
      error: (e) => {
        this.anulando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se anuló', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }

  imprimir(m: Movimiento): void {
    this.servicio.comprobante(m.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.toast.add({ severity: 'error', summary: 'No se pudo generar el comprobante' }),
    });
  }
}
