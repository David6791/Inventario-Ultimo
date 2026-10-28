import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { formatoDinero } from '../../caja/core/dinero';
import { BonoCalculado, LecturaTicket, PlantillaBascula } from '../core/models/cargas.model';
import { RecepcionService } from '../core/services/recepcion.service';
import { FotoTicketComponent, TicketLeido } from './fotos/foto-ticket.component';
import { FotoSimpleComponent } from './fotos/foto-simple.component';
import { ETIQUETA_CRITERIO, pesoQueVale } from '../core/peso-que-vale';
import { FormsModule } from '@angular/forms';

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
    peso_cliente_kg: [null as number | null, [Validators.min(0.01)]],
    peso_cliente_tipo: ['NETO' as 'NETO' | 'BRUTO'],
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

/** Recuerda la última báscula usada en este navegador. */
export function recordarBascula(valor: string | null | undefined): void {
  try { if (valor) localStorage.setItem(CLAVE_BASCULA, valor); } catch { /* sin almacenamiento */ }
}

/**
 * Campos del pesaje con el peso neto y el bono que corresponde, calculados en
 * vivo. El neto y el monto definitivos los pone la base.
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
    <div class="campos" [formGroup]="grupo()">
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

      <div class="campo span-2">
        <label for="bruto">Peso bruto (kg)</label>
        <p-inputNumber inputId="bruto" formControlName="peso_bruto_kg" mode="decimal" locale="es-BO" [maxFractionDigits]="2" [min]="0" />
        <small class="de-foto" *ngIf="deFoto().has('peso_bruto_kg')"><i class="pi pi-camera"></i> {{ deDonde() }}</small>
      </div>
      <div class="campo span-2">
        <label for="tara">Tara (kg)</label>
        <p-inputNumber inputId="tara" formControlName="tara_kg" mode="decimal" locale="es-BO" [maxFractionDigits]="2" [min]="0" />
        <small class="de-foto" *ngIf="deFoto().has('tara_kg')"><i class="pi pi-camera"></i> {{ deDonde() }}</small>
      </div>
      <div class="campo span-2">
        <label>Peso neto (kg)</label>
        <div class="neto" [class.error]="neto() !== null && neto()! <= 0">{{ neto() === null ? '—' : fmt(neto()) }}</div>
        <small *ngIf="neto() !== null && neto()! <= 0" class="error">La tara debe ser menor que el bruto.</small>
      </div>

      <div class="campo span-2">
        <label for="cliente">Peso del cliente (kg) <span class="opcional">(opcional)</span></label>
        <p-inputNumber inputId="cliente" formControlName="peso_cliente_kg" mode="decimal" locale="es-BO" [maxFractionDigits]="2" [min]="0" />
        <p-selectButton [options]="tiposCliente" [allowEmpty]="false" formControlName="peso_cliente_tipo" optionLabel="etiqueta" optionValue="valor"
                        styleClass="tipo-cliente" />
      </div>
      <div class="campo span-4 diferencia">
        <div class="aviso" *ngIf="pareceBruto()">
          <i class="pi pi-exclamation-triangle"></i>
          <span>¿{{ fmt(cliente()) }} es el <b>bruto</b> del cliente? Está a {{ fmt(abs(cliente()! - bruto()!)) }} kg del bruto de la báscula.
            Como neto, la diferencia sería de {{ fmt(abs(cliente()! - neto()!)) }} kg.</span>
          <button type="button" class="enlace" (click)="marcarBruto()">Es el bruto</button>
        </div>
        <ng-container *ngIf="diferencia() as d; else sinCliente">
          <span [class.error]="d.alerta">Neto del cliente {{ fmt(d.clienteNeto) }} kg{{ tipo() === 'BRUTO' ? ' (bruto declarado − tara)' : '' }}.
            Diferencia: <strong class="codigo">{{ d.kg > 0 ? '+' : '' }}{{ fmt(d.kg) }} kg</strong>
            ({{ d.kg > 0 ? '+' : '' }}{{ fmt(d.pct) }} %).</span>
        </ng-container>
        <ng-template #sinCliente><small class="secundario">Si el productor declara su propio peso, anótelo para comparar. Si no, cuenta solo el de la empresa.</small></ng-template>
      </div>

      <div class="campo span-2">
        <label for="placa">Placa</label>
        <input id="placa" pInputText formControlName="placa" maxlength="15" placeholder="1234ABC" class="codigo" />
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

      <div class="campo span-2">
        <label for="orden">N.º de orden <span class="opcional">(opcional)</span></label>
        <input id="orden" pInputText formControlName="numero_orden" maxlength="30" class="codigo" />
        <small class="de-foto" *ngIf="deFoto().has('numero_orden')"><i class="pi pi-camera"></i> {{ deDonde() }}</small>
      </div>
      <div class="campo span-2">
        <label for="fecha-ticket">Fecha de la boleta <span class="opcional">(opcional)</span></label>
        <input id="fecha-ticket" pInputText type="datetime-local" formControlName="fecha_ticket" step="1" />
        <small class="de-foto" *ngIf="deFoto().has('fecha_ticket')"><i class="pi pi-camera"></i> {{ deDonde('a') }}</small>
      </div>
      <div class="campo span-2" *ngIf="productorLeido() as pl">
        <label>Productor en la boleta</label>
        <div class="leido">{{ pl }}</div>
      </div>

      <div class="campo span-6" *ngIf="vale() as v">
        <div class="vale" [class.otro]="v.criterio !== 'EMPRESA'">
          <i class="pi pi-check-square"></i>
          <span>Peso que vale para el lote: <strong class="codigo">{{ fmt(v.kg) }} kg</strong> — {{ etiquetaCriterio[v.criterio] }}.
            <span class="secundario">{{ explicacion(v.criterio) }}</span></span>
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
    </div>
  `,
  styles: [`
    .modo { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.8rem; }
    :host ::ng-deep .modos .p-button { gap: 0.4rem; padding: 0.45rem 0.9rem; font-size: 0.85rem; }
    .fotos.manual { grid-template-columns: 1fr 1fr; }
    .respaldo { display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem; padding: 0.5rem 0.7rem;
                border: 1px dashed var(--surface-border, #cbd5e1); border-radius: 8px; }
    .obligatoria { font-size: 0.7rem; font-weight: 600; color: #92400e; background: #fef3c7; border-radius: 4px; padding: 0.05rem 0.35rem; }
    .vale { display: flex; gap: 0.6rem; align-items: center; padding: 0.6rem 0.9rem; border-radius: 8px; font-size: 0.9rem;
            background: #eef2ff; border: 1px solid #c7d2fe; }
    .vale.otro { background: #fff7ed; border-color: #fed7aa; }
    .vale .secundario { display: block; font-size: 0.78rem; }
    .fotos { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; margin-bottom: 1rem; }
    @media (max-width: 720px) { .fotos { grid-template-columns: 1fr; } }
    .leido { font-size: 0.9rem; padding: 0.5rem 0; font-weight: 550; }
    .de-foto { color: #047857; font-size: 0.72rem; display: flex; gap: 0.25rem; align-items: center; }
    .campos { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.9rem 1rem; }
    .campo { display: flex; flex-direction: column; gap: 0.35rem; }
    .campo label { font-size: 0.8rem; font-weight: 550; }
    .campo :is(input, .p-inputnumber) { width: 100%; }
    :host ::ng-deep .campo .p-inputnumber input { width: 100%; }
    .span-1 { grid-column: span 1; } .span-2 { grid-column: span 2; } .span-3 { grid-column: span 3; } .span-4 { grid-column: span 4; } .span-6 { grid-column: span 6; }
    @media (max-width: 720px) { .campos { grid-template-columns: repeat(2, 1fr); } .span-1, .span-2, .span-3 { grid-column: span 1; } .span-4, .span-6 { grid-column: span 2; } }
    .neto { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 1.25rem; font-weight: 700; padding: 0.35rem 0; }
    .error { color: #b91c1c; }
    .diferencia { justify-content: flex-end; padding-bottom: 0.55rem; font-size: 0.88rem; }
    .aviso { display: flex; gap: 0.5rem; align-items: flex-start; padding: 0.45rem 0.7rem; border-radius: 6px; background: #fef3c7; color: #92400e; }
    .enlace { border: 0; background: none; color: #1d4ed8; font-weight: 600; cursor: pointer; white-space: nowrap; padding: 0; }
    :host ::ng-deep .tipo-cliente .p-button { padding: 0.25rem 0.7rem; font-size: 0.78rem; }
    .secundario { color: var(--text-color-secondary, #6b7280); }
    .opcional { font-weight: 400; color: var(--text-color-secondary, #9ca3af); }
    .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
    .bono { display: flex; gap: 0.6rem; align-items: center; padding: 0.6rem 0.9rem; border-radius: 8px;
            background: #f0fdf4; border: 1px solid #bbf7d0; font-size: 0.88rem; }
    .bono.sin-bono { background: var(--surface-ground, #f8fafc); border-color: var(--surface-border, #e5e7eb); }
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

  readonly deFoto = signal<Set<string>>(new Set());
  /** Límite para promediar (parámetro LIMITE_PROMEDIO_PESO_KG). */
  readonly limite = input(100);
  /** Mixta: kg de sacos que se restan del neto del camión y del cliente. */
  readonly descuentoSacos = input(0);
  /** El servidor tiene la clave de la API de Claude. */
  readonly claudeDisponible = input(false);
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
    MANUAL: 'Escriba los datos mirando la boleta y adjunte la foto o el escaneo como respaldo. Antes de guardar se le pedirá confirmarlos.',
    TESSERACT: 'Tesseract lee los recuadros de la plantilla de cada balanza, en este servidor y sin internet. Revise los datos antes de guardar.',
    CLAUDE: 'Claude lee la boleta completa, sin recuadros. Necesita internet y cada lectura usa créditos de la API. Revise los datos antes de guardar.',
  })[this.modo()]);

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

  /** El peso que valdrá, con la misma regla que la base. */
  readonly vale = computed(() => {
    const n = this.neto();
    if (n === null || n <= 0) return null;
    const d = this.diferencia();
    const s = this.descuentoSacos() || 0;
    return pesoQueVale(n - s, d ? d.clienteNeto - s : null, this.limite());
  });

  explicacion(c: 'EMPRESA' | 'CLIENTE' | 'PROMEDIO'): string {
    const l = this.fmt(this.limite());
    return {
      EMPRESA: this.diferencia() ? `Nuestra báscula pesa menos que el cliente por más de ${l} kg.` : 'El cliente no declaró peso.',
      CLIENTE: 'Nuestra báscula pesa igual o más que el cliente: vale el menor.',
      PROMEDIO: `Nuestra báscula pesa menos que el cliente, hasta ${l} kg: se promedian.`,
    }[c];
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

  readonly neto = signal<number | null>(null);
  readonly bono = signal<BonoCalculado | null>(null);
  readonly cliente = signal<number | null>(null);
  readonly tipo = signal<'NETO' | 'BRUTO'>('NETO');
  readonly bruto = signal<number | null>(null);
  readonly tara = signal<number | null>(null);
  readonly tiposCliente = [{ valor: 'NETO', etiqueta: 'Neto' }, { valor: 'BRUTO', etiqueta: 'Bruto' }];
  readonly abs = Math.abs;

  /** Neto del cliente: el declarado, o su bruto menos la tara de la empresa. Alerta sobre 1 %. */
  readonly diferencia = computed(() => {
    const n = this.neto(), c = this.cliente(), t = this.tara();
    if (n === null || n <= 0 || c === null || c <= 0) return null;
    const clienteNeto = this.tipo() === 'BRUTO' ? (t === null ? null : c - t) : c;
    if (clienteNeto === null) return null;
    const kg = Math.round((clienteNeto - n) * 100) / 100;
    const pct = Math.round((kg / n) * 10000) / 100;
    return { clienteNeto, kg, pct, alerta: Math.abs(pct) > 1 };
  });

  /** Anotado como neto pero más cerca del bruto de la báscula: probablemente es el bruto. */
  readonly pareceBruto = computed(() => {
    const c = this.cliente(), b = this.bruto(), n = this.neto();
    return this.tipo() === 'NETO' && c !== null && b !== null && n !== null && n > 0 && Math.abs(c - b) < Math.abs(c - n);
  });

  marcarBruto(): void { this.grupo().patchValue({ peso_cliente_tipo: 'BRUTO' }); }

  /** Ticket interior leído: llena báscula, ticket, pesos y placa; la persona revisa. */
  ticketInterior(t: TicketLeido): void {
    const c = t.lectura?.campos ?? {};
    const cambios: Record<string, unknown> = { foto_interior_id: t.foto.id };
    const marcados = new Set<string>();
    if (t.bascula) { cambios['bascula'] = t.bascula; marcados.add('bascula'); }
    if (c.ticket?.valor != null) { cambios['ticket'] = String(c.ticket.valor); marcados.add('ticket'); }
    if (typeof c.peso_bruto_kg?.valor === 'number') { cambios['peso_bruto_kg'] = c.peso_bruto_kg.valor; marcados.add('peso_bruto_kg'); }
    if (typeof c.tara_kg?.valor === 'number') { cambios['tara_kg'] = c.tara_kg.valor; marcados.add('tara_kg'); }
    if (c.placa?.valor != null && !this.grupo().value.placa) { cambios['placa'] = String(c.placa.valor).replace(/[^A-Z0-9]/g, ''); }
    if (c.numero_orden?.valor != null) { cambios['numero_orden'] = String(c.numero_orden.valor); marcados.add('numero_orden'); }
    if (t.lectura?.fecha_ticket) { cambios['fecha_ticket'] = t.lectura.fecha_ticket.replace(' ', 'T'); marcados.add('fecha_ticket'); }
    if (c.chofer?.valor != null && !this.grupo().value.chofer_nombre) {
      cambios['chofer_nombre'] = String(c.chofer.valor); marcados.add('chofer_nombre');
    }
    this.grupo().patchValue(cambios);
    this.deFoto.set(marcados);
    this.lecturaInterior.set(t.lectura);
    this.avisarLecturas();
  }

  private avisarLecturas(): void {
    this.leido.emit({ interior: this.lecturaInterior(), exterior: this.lecturaExterior() });
  }

  /** Ticket exterior: su neto (o su bruto, si no se leyó el neto) es el peso del cliente. */
  ticketExterior(t: TicketLeido): void {
    const c = t.lectura?.campos ?? {};
    const cambios: Record<string, unknown> = { foto_exterior_id: t.foto.id };
    if (typeof c.peso_neto_kg?.valor === 'number') {
      cambios['peso_cliente_kg'] = c.peso_neto_kg.valor; cambios['peso_cliente_tipo'] = 'NETO';
    } else if (typeof c.peso_bruto_kg?.valor === 'number') {
      cambios['peso_cliente_kg'] = c.peso_bruto_kg.valor; cambios['peso_cliente_tipo'] = 'BRUTO';
    }
    if (c.chofer?.valor != null && !this.grupo().value.chofer_nombre) cambios['chofer_nombre'] = String(c.chofer.valor);
    this.grupo().patchValue(cambios);
    this.lecturaExterior.set(t.lectura);
    this.avisarLecturas();
  }

  quitarFoto(control: 'foto_interior_id' | 'foto_exterior_id'): void {
    this.grupo().patchValue({ [control]: null });
    if (control === 'foto_interior_id') { this.deFoto.set(new Set()); this.lecturaInterior.set(null); }
    else this.lecturaExterior.set(null);
    this.avisarLecturas();
  }
  readonly fmt = formatoDinero;

  ngOnInit(): void {
    const g = this.grupo();
    if (this.conFotos() && this.fotoObligatoria()) {
      g.get('foto_interior_id')!.setValidators(Validators.required);
      g.get('foto_interior_id')!.updateValueAndValidity({ emitEvent: false });
    }
    g.valueChanges.pipe(takeUntilDestroyed(this.destruir)).subscribe((v) => {
      this.cliente.set(v.peso_cliente_kg ?? null);
      this.tipo.set(v.peso_cliente_tipo ?? 'NETO');
      this.bruto.set(v.peso_bruto_kg ?? null);
      this.tara.set(v.tara_kg ?? null);
    });
    this.grupo().valueChanges.pipe(
      map((v) => (v.peso_bruto_kg != null && v.tara_kg != null ? Math.round((v.peso_bruto_kg - v.tara_kg) * 100) / 100 : null)),
      distinctUntilChanged(),
      switchMap((neto) => {
        this.neto.set(neto);
        return neto && neto > 0 ? this.servicio.calcularBono(neto).pipe(debounceTime(0)) : of(null);
      }),
      takeUntilDestroyed(this.destruir),
    ).subscribe((b) => this.bono.set(b));
  }
}
