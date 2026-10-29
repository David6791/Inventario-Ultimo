import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { formatoDinero } from '../../caja/core/dinero';
import { BonoCalculado, DatosPesaje, LecturaTicket, PesoQueVale, PlantillaBascula } from '../core/models/cargas.model';
import { ETIQUETA_CRITERIO } from '../core/peso-que-vale';
import { RecepcionService } from '../core/services/recepcion.service';
import { FotoSimpleComponent } from './fotos/foto-simple.component';
import { FotoTicketComponent, TicketLeido } from './fotos/foto-ticket.component';

const CLAVE_BASCULA = 'cargas.ultima-bascula';
const CLAVE_MODO = 'cargas.modo-registro';

/** Cómo se registra el pesaje: a mano, leyendo la boleta con Tesseract o con Claude. */
export type ModoRegistro = 'MANUAL' | 'TESSERACT' | 'CLAUDE';

/** Grupo de campos del pesaje (para la recepción y para agregar pesajes a un lote). */
export function grupoPesaje(fb: FormBuilder): FormGroup {
  let bascula = '';
  try { bascula = localStorage.getItem(CLAVE_BASCULA) ?? ''; } catch { /* sin almacenamiento */ }
  return fb.group({
    tipo: ['INGRESO'],
    bascula: [bascula, [Validators.required, Validators.maxLength(40)]],
    ticket: ['', [Validators.required, Validators.maxLength(30)]],
    peso_bruto_kg: [null as number | null, [Validators.required, Validators.min(0.01)]],
    tara_kg: [null as number | null, [Validators.required, Validators.min(0)]],
    // Boleta del cliente: bruto y tara; su neto es la resta.
    peso_cliente_bruto_kg: [null as number | null, [Validators.min(0.01)]],
    peso_cliente_tara_kg: [null as number | null, [Validators.min(0)]],
    // Neto del cliente cuando la boleta solo trae el neto (lectura).
    peso_cliente_kg: [null as number | null, [Validators.min(0.01)]],
    num_sacos: [null as number | null],
    placa: [null as string | null],
    chofer_nombre: ['' as string | null, [Validators.required, Validators.maxLength(150)]],
    chofer_ci: [null as string | null],
    foto_interior_id: [null as number | null],
    foto_exterior_id: [null as number | null],
    numero_orden: [null as string | null, Validators.maxLength(30)],
    fecha_ticket: [null as string | null],
  });
}

/** Neto del cliente: bruto − tara de su boleta, o el neto leído si solo se leyó ese. */
export function netoCliente(v: { peso_cliente_bruto_kg?: number | null; peso_cliente_tara_kg?: number | null; peso_cliente_kg?: number | null }): number | null {
  const b = v.peso_cliente_bruto_kg, t = v.peso_cliente_tara_kg;
  if (b != null && t != null) return Math.round((b - t) * 100) / 100;
  return v.peso_cliente_kg ?? null;
}

/** Datos para el API: el peso del cliente como neto (o como bruto si solo hay bruto). */
export function datosPesaje(g: FormGroup): DatosPesaje {
  const v = g.getRawValue();
  const b = v.peso_cliente_bruto_kg, t = v.peso_cliente_tara_kg;
  const cliente = b != null && t != null ? { peso_cliente_kg: Math.round((b - t) * 100) / 100, peso_cliente_tipo: 'NETO' as const }
    : b != null ? { peso_cliente_kg: b, peso_cliente_tipo: 'BRUTO' as const }
    : { peso_cliente_kg: v.peso_cliente_kg ?? null, peso_cliente_tipo: 'NETO' as const };
  return { ...v, ...cliente };
}

/** Recuerda la última báscula usada en este navegador. */
export function recordarBascula(valor: string | null | undefined): void {
  try { if (valor) localStorage.setItem(CLAVE_BASCULA, valor); } catch { /* sin almacenamiento */ }
}

/**
 * Campos del pesaje en el orden de la boleta: forma de registro y fotos, los
 * datos del lote que se proyecten (productor y mina), transporte, orden y
 * fecha, y lado a lado los pesos de nuestra báscula y los de la boleta del
 * cliente, con el peso que vale según las reglas vigentes (lo calcula la base).
 * Al final, báscula, ticket y sacos.
 */
@Component({
  selector: 'app-pesaje-campos',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InputNumberModule, InputTextModule, SelectButtonModule, FotoTicketComponent, FotoSimpleComponent],
  template: `
    <div class="modo" *ngIf="conFotos()">
      <p-selectButton [options]="modos()" [allowEmpty]="false" [ngModel]="modo()" (ngModelChange)="cambiarModo($event)"
                      optionLabel="etiqueta" optionValue="valor" optionDisabled="deshabilitado" styleClass="modos">
        <ng-template let-m pTemplate="item"><i [class]="m.icono"></i><span>{{ m.etiqueta }}</span></ng-template>
      </p-selectButton>
      <small class="secundario">{{ explicacionModo() }}</small>
    </div>
    <div class="fotos" *ngIf="conFotos() && modo() !== 'MANUAL'">
      <app-foto-ticket tipo="TICKET_INTERIOR" [plantillas]="plantillas()" [obligatoria]="fotoObligatoria()" [lector]="lector()"
                       (listo)="ticketInterior($event)" (quitado)="quitarFoto('foto_interior_id')" />
      <app-foto-ticket tipo="TICKET_EXTERIOR" [plantillas]="plantillas()" [lector]="lector()"
                       (listo)="ticketExterior($event)" (quitado)="quitarFoto('foto_exterior_id')" />
    </div>
    <div class="fotos manual" *ngIf="conFotos() && modo() === 'MANUAL'">
      <div class="respaldo">
        <app-foto-simple tipo="TICKET_INTERIOR" (subida)="grupo().patchValue({ foto_interior_id: $event.id })"
                         [etiqueta]="grupo().value.foto_interior_id ? '' : 'Foto'" />
        <span>Boleta interior (empresa) <span class="obligatoria" *ngIf="fotoObligatoria()">obligatoria</span></span>
      </div>
      <div class="respaldo">
        <app-foto-simple tipo="TICKET_EXTERIOR" (subida)="grupo().patchValue({ foto_exterior_id: $event.id })"
                         [etiqueta]="grupo().value.foto_exterior_id ? '' : 'Foto'" />
        <span>Boleta exterior (cliente) <span class="opcional">(opcional)</span></span>
      </div>
    </div>

    <!-- Productor y mina (o mina propia y bocamina), del formulario del lote -->
    <ng-content />

    <div class="campos" [formGroup]="grupo()">
      <div class="campo span-2">
        <label for="placa">Placa</label>
        <input id="placa" pInputText formControlName="placa" maxlength="15" placeholder="1234ABC" class="codigo" />
        <small class="de-foto" *ngIf="deFoto().has('placa')"><i class="pi pi-camera"></i> {{ deDonde('a') }}</small>
      </div>
      <div class="campo span-3">
        <label for="chofer">Chofer</label>
        <input id="chofer" pInputText formControlName="chofer_nombre" maxlength="150" />
        <small class="de-foto" *ngIf="deFoto().has('chofer_nombre')"><i class="pi pi-camera"></i> {{ deDonde() }}</small>
      </div>
      <div class="campo span-1">
        <label for="chofer_ci">CI</label>
        <input id="chofer_ci" pInputText formControlName="chofer_ci" maxlength="15" />
      </div>

      <div class="campo span-3">
        <label for="orden">N.º de orden <span class="opcional">(opcional)</span></label>
        <input id="orden" pInputText formControlName="numero_orden" maxlength="30" class="codigo" />
        <small class="de-foto" *ngIf="deFoto().has('numero_orden')"><i class="pi pi-camera"></i> {{ deDonde() }}</small>
      </div>
      <div class="campo span-3">
        <label for="fecha-ticket">Fecha de la boleta <span class="opcional">(opcional)</span></label>
        <input id="fecha-ticket" pInputText type="datetime-local" formControlName="fecha_ticket" step="1" />
        <small class="de-foto" *ngIf="deFoto().has('fecha_ticket')"><i class="pi pi-camera"></i> {{ deDonde('a') }}</small>
      </div>
      <div class="campo span-6" *ngIf="productorLeido() as pl">
        <small class="secundario">Productor en la boleta: <b>{{ pl }}</b></small>
      </div>

      <!-- Pesos: nuestra báscula y la boleta del cliente, lado a lado -->
      <div class="span-6 pesos">
        <fieldset class="columna">
          <legend><i class="pi pi-building"></i> Nuestra báscula <span class="secundario">(interior)</span></legend>
          <div class="campo">
            <label for="bruto">Peso bruto (kg)</label>
            <p-inputNumber inputId="bruto" formControlName="peso_bruto_kg" mode="decimal" locale="es-BO" [maxFractionDigits]="2" [min]="0" />
            <small class="de-foto" *ngIf="deFoto().has('peso_bruto_kg')"><i class="pi pi-camera"></i> {{ deDonde() }}</small>
          </div>
          <div class="campo">
            <label for="tara">Tara (kg)</label>
            <p-inputNumber inputId="tara" formControlName="tara_kg" mode="decimal" locale="es-BO" [maxFractionDigits]="2" [min]="0" />
            <small class="de-foto" *ngIf="deFoto().has('tara_kg')"><i class="pi pi-camera"></i> {{ deDonde() }}</small>
          </div>
          <div class="campo">
            <label>Peso neto (kg)</label>
            <div class="neto" [class.error]="neto() !== null && neto()! <= 0">{{ neto() === null ? '—' : fmt(neto()) }}</div>
            <small *ngIf="neto() !== null && neto()! <= 0" class="error">La tara debe ser menor que el bruto.</small>
          </div>
        </fieldset>

        <fieldset class="columna cliente">
          <legend><i class="pi pi-user"></i> Boleta del cliente <span class="secundario">(exterior, opcional)</span></legend>
          <div class="campo">
            <label for="c-bruto">Peso bruto (kg)</label>
            <p-inputNumber inputId="c-bruto" formControlName="peso_cliente_bruto_kg" mode="decimal" locale="es-BO" [maxFractionDigits]="2" [min]="0" />
            <small class="de-foto" *ngIf="deFoto().has('peso_cliente_bruto_kg')"><i class="pi pi-camera"></i> {{ deDonde() }}</small>
          </div>
          <div class="campo">
            <label for="c-tara">Tara (kg)</label>
            <p-inputNumber inputId="c-tara" formControlName="peso_cliente_tara_kg" mode="decimal" locale="es-BO" [maxFractionDigits]="2" [min]="0" />
            <small class="de-foto" *ngIf="deFoto().has('peso_cliente_tara_kg')"><i class="pi pi-camera"></i> {{ deDonde() }}</small>
          </div>
          <div class="campo">
            <label>Peso neto (kg)</label>
            <div class="neto" [class.error]="clienteNeto() !== null && clienteNeto()! <= 0">{{ clienteNeto() === null ? '—' : fmt(clienteNeto()) }}</div>
            <small *ngIf="clienteNeto() !== null && clienteNeto()! <= 0" class="error">La tara debe ser menor que el bruto.</small>
            <small *ngIf="diferencia() as d" [class.error]="d.alerta" class="secundario">Diferencia con la nuestra:
              <strong class="codigo">{{ d.kg > 0 ? '+' : '' }}{{ fmt(d.kg) }} kg</strong> ({{ d.kg > 0 ? '+' : '' }}{{ fmt(d.pct) }} %)</small>
          </div>
        </fieldset>
      </div>

      <div class="campo span-6" *ngIf="vale() as v">
        <div class="vale" [class.otro]="v.criterio !== 'EMPRESA'">
          <i class="pi pi-check-square"></i>
          <span>Peso que vale para el lote: <strong class="codigo">{{ fmt(v.kg) }} kg</strong> — {{ etiquetaCriterio[v.criterio] }}.
            <span class="secundario">{{ v.regla?.descripcion || (v.regla ? 'Regla ' + v.regla.orden + ': ' + v.regla.formula
              : clienteNeto() ? 'Ninguna regla cubre esta diferencia: vale el de nuestra báscula.' : 'El cliente no declaró peso.') }}</span></span>
        </div>
      </div>

      <div class="campo span-6" *ngIf="neto() !== null && neto()! > 0">
        <div class="bono" [class.sin-bono]="!bono()">
          <i class="pi" [class.pi-truck]="bono()" [class.pi-info-circle]="!bono()"></i>
          <span *ngIf="bono() as b">Bono de transporte{{ sinSacos() ? ' (camión completo)' : '' }}: <strong>{{ b.moneda === 'USD' ? 'US$' : 'Bs' }} {{ fmt(b.monto) }}</strong>
            ({{ b.tipo_vehiculo }}). Lo cobra el chofer en caja.</span>
          <span *ngIf="!bono()">Para este peso no corresponde bono de transporte.</span>
        </div>
      </div>

      <!-- Más datos de la boleta -->
      <div class="span-6 mas-datos">Más datos de la boleta</div>
      <div class="campo span-2">
        <label for="bascula">Báscula</label>
        <input id="bascula" pInputText formControlName="bascula" maxlength="40" placeholder="Potosí 1" />
        <small class="de-foto" *ngIf="deFoto().has('bascula')"><i class="pi pi-camera"></i> {{ modo() === 'CLAUDE' ? 'leída por Claude' : 'de la plantilla' }}</small>
      </div>
      <div class="campo span-2">
        <label for="ticket">N.º de ticket</label>
        <input id="ticket" pInputText formControlName="ticket" maxlength="30" class="codigo" />
        <small class="de-foto" *ngIf="deFoto().has('ticket')"><i class="pi pi-camera"></i> {{ deDonde() }}</small>
      </div>
      <div class="campo span-2" *ngIf="!sinSacos()">
        <label for="sacos">Sacos <span class="opcional">(opcional)</span></label>
        <p-inputNumber inputId="sacos" formControlName="num_sacos" [min]="0" [useGrouping]="false" />
      </div>
    </div>
  `,
  styles: [`
    .modo { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.8rem; }
    :host ::ng-deep .modos .p-button { gap: 0.4rem; padding: 0.45rem 0.9rem; font-size: 0.85rem; }
    .fotos { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; margin-bottom: 1rem; }
    @media (max-width: 720px) { .fotos { grid-template-columns: 1fr; } }
    .respaldo { display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem; padding: 0.5rem 0.7rem;
                border: 1px dashed var(--surface-border, #cbd5e1); border-radius: 8px; }
    .obligatoria { font-size: 0.7rem; font-weight: 600; color: #92400e; background: #fef3c7; border-radius: 4px; padding: 0.05rem 0.35rem; }
    .campos { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.9rem 1rem; margin-top: 0.9rem; }
    .campo { display: flex; flex-direction: column; gap: 0.35rem; }
    .campo label { font-size: 0.8rem; font-weight: 550; }
    .campo :is(input, .p-inputnumber) { width: 100%; }
    :host ::ng-deep .campo .p-inputnumber, :host ::ng-deep .campo .p-inputnumber input { width: 100%; }
    .span-1 { grid-column: span 1; } .span-2 { grid-column: span 2; } .span-3 { grid-column: span 3; } .span-6 { grid-column: span 6; }
    @media (max-width: 720px) { .campos { grid-template-columns: repeat(2, 1fr); } .span-1, .span-2, .span-3 { grid-column: span 1; } .span-6 { grid-column: span 2; } }
    .pesos { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 720px) { .pesos { grid-template-columns: 1fr; } }
    .columna { border: 1px solid var(--surface-border, #e5e7eb); border-radius: 10px; padding: 0.6rem 0.9rem 0.8rem; margin: 0;
               display: flex; flex-direction: column; gap: 0.7rem; min-width: 0; }
    .columna.cliente { background: var(--surface-ground, #f8fafc); }
    .columna legend { font-size: 0.82rem; font-weight: 650; padding: 0 0.35rem; display: flex; gap: 0.35rem; align-items: center; }
    .neto { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 1.25rem; font-weight: 700; padding: 0.2rem 0; }
    .vale { display: flex; gap: 0.6rem; align-items: center; padding: 0.6rem 0.9rem; border-radius: 8px; font-size: 0.9rem;
            background: #eef2ff; border: 1px solid #c7d2fe; }
    .vale.otro { background: #fff7ed; border-color: #fed7aa; }
    .vale .secundario { display: block; font-size: 0.78rem; }
    .bono { display: flex; gap: 0.6rem; align-items: center; padding: 0.6rem 0.9rem; border-radius: 8px;
            background: #f0fdf4; border: 1px solid #bbf7d0; font-size: 0.88rem; }
    .bono.sin-bono { background: var(--surface-ground, #f8fafc); border-color: var(--surface-border, #e5e7eb); }
    .mas-datos { font-size: 0.72rem; font-weight: 650; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-color-secondary, #6b7280);
                 border-top: 1px solid var(--surface-border, #e5e7eb); padding-top: 0.7rem; margin-top: 0.2rem; }
    .de-foto { color: #047857; font-size: 0.72rem; display: flex; gap: 0.25rem; align-items: center; }
    .error { color: #b91c1c; }
    .secundario { color: var(--text-color-secondary, #6b7280); }
    .opcional { font-weight: 400; color: var(--text-color-secondary, #9ca3af); }
    .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
  `],
})
export class PesajeCamposComponent implements OnInit {
  readonly grupo = input.required<FormGroup>();
  /** Fotos de los tickets (interior y exterior) con lectura. */
  readonly conFotos = input(true);
  readonly plantillas = input<PlantillaBascula[]>([]);
  readonly fotoObligatoria = input(false);
  /** Mixta: los sacos van en el otro lote. */
  readonly sinSacos = input(false);
  /** Mixta: kg de sacos que se restan del neto del camión y del cliente. */
  readonly descuentoSacos = input(0);
  /** El servidor tiene la clave de la API de Claude. */
  readonly claudeDisponible = input(false);

  readonly deFoto = signal<Set<string>>(new Set());
  readonly modos = computed(() => [
    { valor: 'MANUAL', etiqueta: 'Manual', icono: 'pi pi-pencil', deshabilitado: false },
    { valor: 'TESSERACT', etiqueta: 'Lector Tesseract', icono: 'pi pi-th-large', deshabilitado: false },
    { valor: 'CLAUDE', etiqueta: this.claudeDisponible() ? 'Lector Claude' : 'Lector Claude (sin configurar)', icono: 'pi pi-sparkles',
      deshabilitado: !this.claudeDisponible() },
  ]);
  private readonly modoElegido = signal<ModoRegistro>(PesajeCamposComponent.modoGuardado());
  /** Claude elegido pero sin clave en el servidor: se usa Tesseract. */
  readonly modo = computed<ModoRegistro>(() => this.modoElegido() === 'CLAUDE' && !this.claudeDisponible() ? 'TESSERACT' : this.modoElegido());
  readonly lector = computed(() => this.modo() === 'CLAUDE' ? 'claude' as const : 'tesseract' as const);
  readonly modoCambiado = output<ModoRegistro>();
  readonly etiquetaCriterio = ETIQUETA_CRITERIO;
  readonly explicacionModo = computed(() => ({
    MANUAL: 'Escriba los datos mirando la boleta y adjunte la foto o el escaneo como respaldo.',
    TESSERACT: 'Tesseract lee los recuadros de la plantilla de cada balanza, en este servidor y sin internet.',
    CLAUDE: 'Claude lee la boleta completa, sin recuadros. Necesita internet y cada lectura usa créditos de la API.',
  })[this.modo()] + ' Antes de guardar se le pedirá confirmar los datos.');

  deDonde(genero: 'o' | 'a' = 'o'): string {
    return this.modo() === 'CLAUDE' ? `leíd${genero} por Claude` : `leíd${genero} de la foto`;
  }

  private static modoGuardado(): ModoRegistro {
    try {
      const m = localStorage.getItem(CLAVE_MODO);
      return m === 'MANUAL' || m === 'CLAUDE' ? m : 'TESSERACT';       // «LECTOR» de antes = Tesseract
    } catch { return 'TESSERACT'; }
  }

  cambiarModo(m: ModoRegistro): void {
    if (m === this.modo()) return;
    this.modoElegido.set(m);
    this.modoCambiado.emit(this.modo());
    try { localStorage.setItem(CLAVE_MODO, m); } catch { /* sin almacenamiento */ }
    // Las fotos del otro modo no se arrastran: se vuelven a adjuntar.
    this.grupo().patchValue({ foto_interior_id: null, foto_exterior_id: null });
    this.deFoto.set(new Set());
    this.lecturaInterior.set(null);
    this.lecturaExterior.set(null);
    this.avisarLecturas();
  }

  /** Lo leído de cada boleta, para buscar el productor y avisar diferencias. */
  readonly lecturaInterior = signal<LecturaTicket | null>(null);
  readonly lecturaExterior = signal<LecturaTicket | null>(null);
  readonly leido = output<{ interior: LecturaTicket | null; exterior: LecturaTicket | null }>();
  readonly productorLeido = computed(() => {
    const v = this.lecturaInterior()?.campos.productor?.valor ?? this.lecturaExterior()?.campos.productor?.valor;
    return v ? String(v) : null;
  });

  private readonly servicio = inject(RecepcionService);
  private readonly destruir = inject(DestroyRef);
  private readonly sacos$ = toObservable(this.descuentoSacos);

  readonly neto = signal<number | null>(null);
  readonly clienteNeto = signal<number | null>(null);
  readonly bono = signal<BonoCalculado | null>(null);
  /** Peso que vale según las reglas vigentes (lo calcula la base). */
  readonly vale = signal<PesoQueVale | null>(null);
  readonly fmt = formatoDinero;

  /** Diferencia del neto del cliente con el nuestro. Alerta sobre 1 %. */
  readonly diferencia = computed(() => {
    const n = this.neto(), c = this.clienteNeto();
    if (n === null || n <= 0 || c === null || c <= 0) return null;
    const kg = Math.round((c - n) * 100) / 100;
    const pct = Math.round((kg / n) * 10000) / 100;
    return { kg, pct, alerta: Math.abs(pct) > 1 };
  });

  /** Ticket interior leído: llena báscula, ticket, pesos, transporte, orden y fecha; la persona revisa. */
  ticketInterior(t: TicketLeido): void {
    const c = t.lectura?.campos ?? {};
    const cambios: Record<string, unknown> = { foto_interior_id: t.foto.id };
    const marcados = new Set<string>();
    const poner = (control: string, valor: unknown) => { cambios[control] = valor; marcados.add(control); };
    if (t.bascula) poner('bascula', t.bascula);
    if (c.ticket?.valor != null) poner('ticket', String(c.ticket.valor));
    if (typeof c.peso_bruto_kg?.valor === 'number') poner('peso_bruto_kg', c.peso_bruto_kg.valor);
    if (typeof c.tara_kg?.valor === 'number') poner('tara_kg', c.tara_kg.valor);
    if (c.placa?.valor != null) poner('placa', String(c.placa.valor).replace(/[^A-Z0-9]/g, ''));
    if (c.numero_orden?.valor != null) poner('numero_orden', String(c.numero_orden.valor));
    if (t.lectura?.fecha_ticket) poner('fecha_ticket', t.lectura.fecha_ticket.replace(' ', 'T'));
    if (c.chofer?.valor != null) poner('chofer_nombre', String(c.chofer.valor));
    this.grupo().patchValue(cambios);
    this.deFoto.update((s) => new Set([...[...s].filter((k) => k.startsWith('peso_cliente')), ...marcados]));
    this.lecturaInterior.set(t.lectura);
    this.avisarLecturas();
  }

  private avisarLecturas(): void {
    this.leido.emit({ interior: this.lecturaInterior(), exterior: this.lecturaExterior() });
  }

  /** Ticket exterior: bruto y tara del cliente (o solo su neto, si es lo único que se leyó). */
  ticketExterior(t: TicketLeido): void {
    const c = t.lectura?.campos ?? {};
    const num = (x: unknown) => (typeof x === 'number' ? x : null);
    const b = num(c.peso_bruto_kg?.valor), ta = num(c.tara_kg?.valor), n = num(c.peso_neto_kg?.valor);
    const cambios: Record<string, unknown> = { foto_exterior_id: t.foto.id };
    const marcados = new Set<string>();
    if (b !== null && (ta !== null || n !== null)) {
      cambios['peso_cliente_bruto_kg'] = b;
      cambios['peso_cliente_tara_kg'] = ta ?? Math.round((b - n!) * 100) / 100;
      cambios['peso_cliente_kg'] = null;
      marcados.add('peso_cliente_bruto_kg'); marcados.add('peso_cliente_tara_kg');
    } else if (n !== null) {
      cambios['peso_cliente_bruto_kg'] = null; cambios['peso_cliente_tara_kg'] = null; cambios['peso_cliente_kg'] = n;
    } else if (b !== null) {
      cambios['peso_cliente_bruto_kg'] = b; marcados.add('peso_cliente_bruto_kg');
    }
    if (c.chofer?.valor != null && !this.grupo().value.chofer_nombre) cambios['chofer_nombre'] = String(c.chofer.valor);
    this.grupo().patchValue(cambios);
    this.deFoto.update((s) => new Set([...[...s].filter((k) => !k.startsWith('peso_cliente')), ...marcados]));
    this.lecturaExterior.set(t.lectura);
    this.avisarLecturas();
  }

  quitarFoto(control: 'foto_interior_id' | 'foto_exterior_id'): void {
    this.grupo().patchValue({ [control]: null });
    if (control === 'foto_interior_id') {
      this.deFoto.update((s) => new Set([...s].filter((k) => k.startsWith('peso_cliente'))));
      this.lecturaInterior.set(null);
    } else {
      this.deFoto.update((s) => new Set([...s].filter((k) => !k.startsWith('peso_cliente'))));
      this.lecturaExterior.set(null);
    }
    this.avisarLecturas();
  }

  ngOnInit(): void {
    const g = this.grupo();
    if (this.conFotos() && this.fotoObligatoria()) {
      g.get('foto_interior_id')!.setValidators(Validators.required);
      g.get('foto_interior_id')!.updateValueAndValidity({ emitEvent: false });
    }
    // Si se escriben bruto o tara del cliente, deja de valer el neto que se había leído solo.
    for (const c of ['peso_cliente_bruto_kg', 'peso_cliente_tara_kg']) {
      g.get(c)!.valueChanges.pipe(takeUntilDestroyed(this.destruir)).subscribe((v) => {
        if (v != null && g.value.peso_cliente_kg != null) g.patchValue({ peso_cliente_kg: null });
      });
    }

    const pesos$ = g.valueChanges.pipe(
      map((v) => ({
        neto: v.peso_bruto_kg != null && v.tara_kg != null ? Math.round((v.peso_bruto_kg - v.tara_kg) * 100) / 100 : null,
        cliente: netoCliente(v),
      })),
      distinctUntilChanged((a, b) => a.neto === b.neto && a.cliente === b.cliente),
      takeUntilDestroyed(this.destruir),
    );
    pesos$.subscribe(({ neto, cliente }) => { this.neto.set(neto); this.clienteNeto.set(cliente); });

    // Bono por el neto del camión.
    pesos$.pipe(
      map((p) => p.neto), distinctUntilChanged(),
      switchMap((neto) => neto && neto > 0 ? this.servicio.calcularBono(neto).pipe(catchError(() => of(null))) : of(null)),
    ).subscribe((b) => this.bono.set(b));

    // Peso que vale con las reglas vigentes (en mixta, sin los sacos).
    combineLatest([pesos$, this.sacos$]).pipe(
      debounceTime(250),
      switchMap(([{ neto, cliente }, sacos]) => {
        const s = sacos || 0;
        if (neto === null || neto - s <= 0) return of(null);
        return this.servicio.pesoQueVale(neto - s, cliente && cliente - s > 0 ? cliente - s : null).pipe(catchError(() => of(null)));
      }),
    ).subscribe((v) => this.vale.set(v));
  }
}
