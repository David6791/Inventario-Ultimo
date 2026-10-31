import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToastModule } from 'primeng/toast';
import { hoy } from '../../caja/core/archivos';
import { formatoDinero } from '../../caja/core/dinero';
import { PermisosService } from '../../core/services/permisos.service';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { CalculoBono, SerieLote, TablaBono, TipoBono, TramoBono } from '../core/models/cargas.model';
import { RecepcionService } from '../core/services/recepcion.service';
import { SeriesService } from '../core/services/series.service';

interface Fila { etiqueta: string; desde: number | null; hasta: number | null; monto: number | null; }

export const CALCULOS: { valor: CalculoBono; etiqueta: string; ayuda: string }[] = [
  { valor: 'TRAMOS_PESO',   etiqueta: 'Tramos por peso',     ayuda: 'Según el peso del camión en la báscula (como el de transporte).' },
  { valor: 'POR_TONELADA',  etiqueta: 'Monto por tonelada',  ayuda: 'Un monto por cada tonelada del camión en la báscula.' },
  { valor: 'POR_ELEMENTOS', etiqueta: 'Por elementos',       ayuda: 'Según cuántos elementos trae el material (como el de laboratorio).' },
  { valor: 'FIJO',          etiqueta: 'Monto fijo por lote', ayuda: 'El mismo monto en cada lote que aplica.' },
  { valor: 'MANUAL',        etiqueta: 'Monto a mano',        ayuda: 'Se agrega en la ficha del lote y se anota el monto cada vez.' },
];

/**
 * Catálogo de bonos: cada bono dice cómo se calcula, quién cobra, si es
 * anticipo (la liquidación lo descuenta) o premio, y a qué lotes aplica. Las
 * tablas de montos se publican con vigencia: los bonos ya calculados no cambian.
 */
@Component({
  selector: 'app-catalogo-bonos',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, CheckboxModule, DialogModule, DropdownModule, InputNumberModule,
            InputTextModule, SelectButtonModule, ToastModule, TienePermisoDirective],
  providers: [MessageService],
  template: `
    <p-toast />
    <header class="encabezado">
      <div>
        <h2>Bonos</h2>
        <p class="subtitulo">Lo que paga la caja del acopio por cada carga. Los <b>anticipos</b> se descuentan en la liquidación;
          los <b>premios</b>, no. Cada bono nace solo al recibir, salvo los de monto a mano, que se agregan en la ficha del lote.</p>
      </div>
      <div class="acciones" *appTienePermiso="'cargas.configurar-bono'">
        <p-button label="Nuevo bono" icon="pi pi-plus" (onClick)="nuevo()" />
      </div>
    </header>

    <div class="vacio" *ngIf="cargando()"><i class="pi pi-spin pi-spinner"></i></div>

    <section class="bono" *ngFor="let t of tipos()" [class.inactivo]="!t.activo">
      <div class="cabeza">
        <div>
          <h3>{{ t.nombre }} <span class="codigo">{{ t.codigo }}</span></h3>
          <div class="etiquetas">
            <span class="pastilla" [class.pastilla-acento]="t.naturaleza === 'ANTICIPO'" [class.premio]="t.naturaleza === 'PREMIO'">
              {{ t.naturaleza === 'ANTICIPO' ? 'Anticipo · se descuenta' : 'Premio · no se descuenta' }}</span>
            <span class="pastilla">{{ calculo(t.calculo) }}</span>
            <span class="pastilla">Cobra {{ t.cobra === 'CHOFER' ? 'el chofer' : 'el productor' }}{{ t.permite_otro ? ' u otra persona' : '' }}</span>
            <span class="pastilla">{{ t.serie ? 'Serie ' + t.serie.prefijo : t.aplica_a === 'TODOS' ? 'Todos los lotes' : t.aplica_a === 'COMPRA' ? 'Lotes de compra' : 'Producción propia' }}</span>
            <span class="pastilla pastilla-aviso" *ngIf="!t.activo">Desactivado</span>
            <span class="pastilla pastilla-aviso" *ngIf="t.activo && t.calculo !== 'MANUAL' && !vigente(t)">Sin tabla vigente: no se genera</span>
          </div>
          <p class="secundario" *ngIf="t.descripcion">{{ t.descripcion }}</p>
        </div>
        <div class="botones" *appTienePermiso="'cargas.configurar-bono'">
          <p-button label="Editar" icon="pi pi-pencil" [text]="true" size="small" (onClick)="editar(t)" />
          <p-button *ngIf="t.calculo !== 'MANUAL'" label="Nueva tabla" icon="pi pi-table" [outlined]="true" size="small" (onClick)="nuevaTabla(t)" />
        </div>
      </div>

      <div class="cifras">
        <span *ngIf="t.bonos_pendientes"><b>{{ t.bonos_pendientes }}</b> por pagar en caja</span>
        <span class="secundario">Concepto de caja: {{ t.concepto?.nombre }}</span>
      </div>

      <ng-container *ngIf="t.calculo !== 'MANUAL'">
        <div *ngFor="let tb of tablasVisibles(t)" class="tabla" [class.anterior]="tb.estado === 'ANTERIOR'">
          <h4>
            <span class="pastilla" [class.pastilla-acento]="tb.estado === 'VIGENTE'" [class.pastilla-aviso]="tb.estado === 'PROXIMA'">
              {{ tb.estado === 'VIGENTE' ? 'Vigente' : tb.estado === 'PROXIMA' ? 'Próxima' : 'Anterior' }}</span>
            Desde {{ tb.vigente_desde | date: 'dd/MM/yyyy' }}{{ tb.vigente_hasta ? ' hasta ' + (tb.vigente_hasta | date: 'dd/MM/yyyy') : '' }}
          </h4>
          <table class="montos">
            <tbody>
              <tr *ngFor="let r of tb.tramos">
                <td>{{ rango(t.calculo, r) }}</td>
                <td class="derecha monto">{{ r.moneda === 'USD' ? 'US$' : 'Bs' }} {{ fmt(r.monto) }}{{ t.calculo === 'POR_TONELADA' ? ' por t' : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button type="button" class="enlace" *ngIf="(t.tablas?.length ?? 0) > tablasVisibles(t).length" (click)="historial[t.id] = true">
          Ver tablas anteriores ({{ (t.tablas?.length ?? 0) - tablasVisibles(t).length }})</button>
      </ng-container>
      <p class="secundario" *ngIf="t.calculo === 'MANUAL'">Se agrega en la ficha de cada lote (Manejo de cargas → Recepción de lotes → el lote → Bonos).</p>
    </section>

    <!-- Alta o cambio de un bono -->
    <p-dialog [(visible)]="editorVisible" [header]="editando()?.id ? 'Editar bono' : 'Nuevo bono'" [modal]="true"
              [style]="{ width: '40rem', maxWidth: '97vw' }" [draggable]="false">
      <div class="campos">
        <div class="campo span-4">
          <label for="nombre">Nombre</label>
          <input id="nombre" pInputText [(ngModel)]="form.nombre" maxlength="80" placeholder="Bono de carguío" />
        </div>
        <div class="campo span-2">
          <label for="codigo">Código</label>
          <input id="codigo" pInputText [(ngModel)]="form.codigo" maxlength="20" placeholder="CARGUIO" [disabled]="codigoFijo()" />
        </div>
        <div class="campo span-6">
          <label for="calculo">Cómo se calcula</label>
          <p-dropdown inputId="calculo" [(ngModel)]="form.calculo" [options]="calculos" optionLabel="etiqueta" optionValue="valor"
                      [disabled]="calculoFijo()" appendTo="body" [style]="{ width: '100%' }" />
          <small>{{ ayuda(form.calculo) }}{{ calculoFijo() ? ' Ya tiene tabla o bonos: el cálculo no se cambia.' : '' }}</small>
        </div>
        <div class="campo span-6">
          <label>¿Se descuenta en la liquidación?</label>
          <p-selectButton [(ngModel)]="form.naturaleza" [options]="naturalezas" optionLabel="etiqueta" optionValue="valor" [allowEmpty]="false" />
        </div>
        <div class="campo span-3">
          <label>Cobra</label>
          <p-selectButton [(ngModel)]="form.cobra" [options]="cobradores" optionLabel="etiqueta" optionValue="valor" [allowEmpty]="false" />
        </div>
        <div class="campo span-3 check-campo">
          <label class="check"><p-checkbox [(ngModel)]="form.permite_otro" [binary]="true" inputId="otro" />
            <span>Puede cobrar otra persona (se anota su nombre en caja)</span></label>
        </div>
        <div class="campo span-3">
          <label for="aplica">Aplica a</label>
          <p-dropdown inputId="aplica" [(ngModel)]="form.aplica_a" [options]="aplicaciones" optionLabel="etiqueta" optionValue="valor" appendTo="body" [style]="{ width: '100%' }" />
        </div>
        <div class="campo span-3">
          <label for="serie">Solo la serie <span class="opcional">(opcional)</span></label>
          <p-dropdown inputId="serie" [(ngModel)]="form.serie_id" [options]="series()" optionValue="id" [showClear]="true"
                      placeholder="Todas" appendTo="body" [style]="{ width: '100%' }">
            <ng-template let-s pTemplate="item">{{ s.prefijo }} · {{ s.nombre }}</ng-template>
            <ng-template let-s pTemplate="selectedItem">{{ s.prefijo }} · {{ s.nombre }}</ng-template>
          </p-dropdown>
        </div>
        <div class="campo span-6">
          <label for="desc">Descripción <span class="opcional">(opcional)</span></label>
          <input id="desc" pInputText [(ngModel)]="form.descripcion" maxlength="250" />
        </div>
        <div class="campo span-6" *ngIf="editando()?.id">
          <label class="check"><p-checkbox [(ngModel)]="form.activo" [binary]="true" inputId="activo" />
            <span>Activo: se genera en las recepciones nuevas</span></label>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="editorVisible = false" />
        <p-button label="Guardar" icon="pi pi-check" [loading]="guardando()" [disabled]="guardando()" (onClick)="guardar()" />
      </ng-template>
    </p-dialog>

    <!-- Nueva tabla de montos -->
    <p-dialog [(visible)]="tablaVisible" [header]="'Nueva tabla · ' + (enTabla()?.nombre ?? '')" [modal]="true"
              [style]="{ width: '46rem', maxWidth: '97vw' }" [draggable]="false">
      <ng-container *ngIf="enTabla() as t">
        <p class="explicacion">{{ explicacionTabla(t.calculo) }} La tabla vigente se cierra el día que empieza esta;
          los bonos ya calculados no cambian.</p>
        <div class="fila-arriba">
          <div class="campo">
            <label for="vdesde">Vigente desde</label>
            <input id="vdesde" pInputText type="date" [(ngModel)]="desde" [min]="minimo" />
          </div>
          <div class="campo">
            <label for="moneda">Moneda</label>
            <p-dropdown inputId="moneda" [(ngModel)]="moneda" [options]="monedas" appendTo="body" />
          </div>
        </div>

        <table class="editor">
          <thead>
            <tr>
              <th *ngIf="t.calculo === 'TRAMOS_PESO'">Vehículo</th>
              <th *ngIf="t.calculo === 'TRAMOS_PESO'">Desde kg</th>
              <th *ngIf="t.calculo === 'TRAMOS_PESO'">Hasta kg</th>
              <th *ngIf="t.calculo === 'POR_ELEMENTOS'">Elementos</th>
              <th>{{ t.calculo === 'POR_TONELADA' ? 'Monto por tonelada' : 'Monto' }}</th>
              <th *ngIf="multiple(t.calculo)"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let f of filas; let i = index">
              <td *ngIf="t.calculo === 'TRAMOS_PESO'"><input pInputText [(ngModel)]="f.etiqueta" maxlength="30" placeholder="Camión" /></td>
              <td *ngIf="t.calculo === 'TRAMOS_PESO'"><p-inputNumber [(ngModel)]="f.desde" [min]="0" [maxFractionDigits]="2" locale="es-BO" /></td>
              <td *ngIf="t.calculo === 'TRAMOS_PESO'"><p-inputNumber [(ngModel)]="f.hasta" [min]="0" [maxFractionDigits]="2" locale="es-BO" placeholder="en adelante" /></td>
              <td *ngIf="t.calculo === 'POR_ELEMENTOS'"><p-inputNumber [(ngModel)]="f.desde" [min]="1" [max]="9" [showButtons]="true" /></td>
              <td><p-inputNumber [(ngModel)]="f.monto" [min]="0" [minFractionDigits]="2" [maxFractionDigits]="2" locale="es-BO" /></td>
              <td *ngIf="multiple(t.calculo)">
                <p-button icon="pi pi-trash" [text]="true" [rounded]="true" severity="danger" [disabled]="filas.length === 1"
                          (onClick)="filas.splice(i, 1)" ariaLabel="Quitar fila" /></td>
            </tr>
          </tbody>
        </table>
        <p-button *ngIf="multiple(t.calculo)" label="Agregar fila" icon="pi pi-plus" [text]="true" size="small" (onClick)="agregarFila(t.calculo)" />
      </ng-container>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="tablaVisible = false" />
        <p-button label="Publicar" icon="pi pi-check" [loading]="guardando()" [disabled]="!tablaValida() || guardando()" (onClick)="publicar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CARGAS, `
    .bono { border: 1px solid var(--surface-border, #e5e7eb); border-radius: 10px; padding: 0.9rem 1rem; margin-bottom: 0.9rem;
            background: var(--surface-card, #fff); }
    .bono.inactivo { opacity: 0.6; }
    .cabeza { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; flex-wrap: wrap; }
    .cabeza > div:first-child { flex: 1 1 24rem; min-width: 0; }
    .cabeza h3 { margin: 0 0 0.35rem; font-size: 1.02rem; display: flex; gap: 0.5rem; align-items: baseline; }
    .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 0.75rem; color: var(--text-color-secondary, #6b7280); }
    .etiquetas { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .pastilla.premio { background: #ede9fe; color: #5b21b6; }
    .botones { display: flex; gap: 0.3rem; }
    .cifras { display: flex; gap: 1.2rem; font-size: 0.85rem; margin: 0.6rem 0 0.2rem; flex-wrap: wrap; }
    .tabla { margin-top: 0.6rem; }
    .tabla.anterior { opacity: 0.6; }
    .tabla h4 { font-size: 0.85rem; display: flex; gap: 0.5rem; align-items: center; margin: 0 0 0.3rem; font-weight: 500; }
    .montos { border-collapse: collapse; min-width: 22rem; max-width: 100%; font-size: 0.88rem; }
    .montos td { padding: 0.22rem 0.6rem 0.22rem 0; border-bottom: 1px solid var(--surface-border, #eef0f3); }
    .monto { font-family: ui-monospace, 'SF Mono', Menlo, monospace; white-space: nowrap; }
    .derecha { text-align: right; }
    .enlace { background: none; border: 0; padding: 0; color: var(--primary-color, #0369a1); cursor: pointer; font-size: 0.82rem; margin-top: 0.4rem; }
    .explicacion { font-size: 0.88rem; line-height: 1.5; margin-top: 0; }
    .fila-arriba { display: flex; gap: 1rem; margin-bottom: 0.8rem; flex-wrap: wrap; }
    .fila-arriba .campo { display: flex; flex-direction: column; gap: 0.3rem; min-width: 10rem; }
    .editor { width: 100%; border-collapse: collapse; }
    .editor th { text-align: left; font-size: 0.72rem; text-transform: uppercase; color: var(--text-color-secondary, #6b7280); padding: 0.2rem; }
    .editor td { padding: 0.2rem; }
    .editor input { width: 100%; }
    :host ::ng-deep .editor .p-inputnumber, :host ::ng-deep .editor .p-inputnumber-input { width: 100%; }
    .check { display: flex; gap: 0.55rem; align-items: flex-start; font-size: 0.88rem; font-weight: 400 !important; cursor: pointer; }
    .check-campo { justify-content: flex-end; }
    .opcional { font-weight: 400; color: var(--text-color-secondary, #6b7280); }
  `],
})
export class CatalogoBonosComponent implements OnInit {
  private readonly servicio = inject(RecepcionService);
  private readonly seriesSrv = inject(SeriesService);
  private readonly toast = inject(MessageService);
  private readonly permisos = inject(PermisosService);

  readonly tipos = signal<TipoBono[]>([]);
  readonly series = signal<SerieLote[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly editando = signal<TipoBono | null>(null);
  readonly enTabla = signal<TipoBono | null>(null);
  historial: Record<number, boolean> = {};

  readonly calculos = CALCULOS;
  readonly naturalezas = [{ valor: 'ANTICIPO', etiqueta: 'Sí — anticipo' }, { valor: 'PREMIO', etiqueta: 'No — premio' }];
  readonly cobradores = [{ valor: 'PRODUCTOR', etiqueta: 'Productor' }, { valor: 'CHOFER', etiqueta: 'Chofer' }];
  readonly aplicaciones = [{ valor: 'COMPRA', etiqueta: 'Lotes de compra' }, { valor: 'PROPIA', etiqueta: 'Producción propia' },
                           { valor: 'TODOS', etiqueta: 'Todos los lotes' }];
  readonly monedas = ['BOB', 'USD'];

  editorVisible = false;
  tablaVisible = false;
  form: Partial<TipoBono> = {};
  desde = hoy();
  readonly minimo = hoy();
  moneda = 'BOB';
  filas: Fila[] = [];

  ngOnInit(): void {
    this.cargar();
    this.seriesSrv.listar().subscribe({ next: (r) => this.series.set(r.data), error: () => this.series.set([]) });
  }

  cargar(): void {
    this.servicio.tiposBono().subscribe({
      next: (t) => { this.tipos.set(t); this.cargando.set(false); },
      error: (e) => {
        this.cargando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo cargar el catálogo', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }

  fmt(v: string | number | null | undefined): string { return formatoDinero(v ?? 0); }
  calculo(c: CalculoBono): string { return CALCULOS.find((x) => x.valor === c)?.etiqueta ?? c; }
  ayuda(c?: CalculoBono): string { return CALCULOS.find((x) => x.valor === c)?.ayuda ?? ''; }
  multiple(c: CalculoBono): boolean { return c === 'TRAMOS_PESO' || c === 'POR_ELEMENTOS'; }
  vigente(t: TipoBono): TablaBono | undefined { return t.tablas?.find((x) => x.estado === 'VIGENTE'); }

  /** Vigente y próxima; las anteriores solo si se pidió el historial. */
  tablasVisibles(t: TipoBono): TablaBono[] {
    return (t.tablas ?? []).filter((x) => this.historial[t.id] || x.estado !== 'ANTERIOR');
  }

  rango(c: CalculoBono, r: TramoBono): string {
    switch (c) {
      case 'TRAMOS_PESO':
        return `${r.etiqueta ? r.etiqueta + ' · ' : ''}${this.kg(r.desde)} a ${r.hasta === null || r.hasta === undefined ? 'más' : this.kg(r.hasta)} kg`;
      case 'POR_ELEMENTOS': {
        const n = Math.round(+(r.desde ?? 0));
        return `${n} elemento${n === 1 ? '' : 's'}`;
      }
      case 'POR_TONELADA': return 'Cada tonelada del camión';
      default: return 'Cada lote';
    }
  }

  private kg(v: string | number | null | undefined): string {
    return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 }).format(+(v ?? 0));
  }

  codigoFijo(): boolean { const t = this.editando(); return !!t?.id && (t.sistema || (t.bonos_total ?? 0) > 0); }
  calculoFijo(): boolean { const t = this.editando(); return !!t?.id && (t.sistema || (t.bonos_total ?? 0) > 0 || (t.tablas?.length ?? 0) > 0); }

  nuevo(): void {
    this.editando.set({} as TipoBono);
    this.form = { codigo: '', nombre: '', descripcion: '', calculo: 'FIJO', naturaleza: 'ANTICIPO', cobra: 'PRODUCTOR',
                  permite_otro: true, aplica_a: 'COMPRA', serie_id: null, activo: true };
    this.editorVisible = true;
  }

  editar(t: TipoBono): void {
    this.editando.set(t);
    this.form = { codigo: t.codigo, nombre: t.nombre, descripcion: t.descripcion, calculo: t.calculo, naturaleza: t.naturaleza,
                  cobra: t.cobra, permite_otro: t.permite_otro, aplica_a: t.aplica_a, serie_id: t.serie_id, activo: t.activo };
    this.editorVisible = true;
  }

  guardar(): void {
    const t = this.editando();
    this.guardando.set(true);
    this.servicio.guardarTipoBono(this.form, t?.id).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.editorVisible = false;
        this.toast.add({ severity: 'success', summary: r.mensaje, life: 7000 });
        this.cargar();
        if (!t?.id && r.data.calculo !== 'MANUAL') this.nuevaTabla({ ...r.data, tablas: [] });
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se guardó el bono', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }

  explicacionTabla(c: CalculoBono): string {
    return {
      TRAMOS_PESO: 'Cada tramo cubre desde su peso (inclusive) hasta el siguiente (sin incluirlo); deje «hasta» vacío en el último. Cuenta el peso del camión en la báscula.',
      POR_ELEMENTOS: 'Un monto por cantidad de elementos del material (ZN-AG = 2, ZN-AG-PB = 3).',
      POR_TONELADA: 'El bono es este monto por cada tonelada del camión en la báscula (8.200 kg = 8,2 t).',
      FIJO: 'Cada lote que aplica recibe este monto.',
      MANUAL: '',
    }[c];
  }

  /** Parte de la tabla más reciente para editar solo lo que cambia. */
  nuevaTabla(t: TipoBono): void {
    this.enTabla.set(t);
    const base = t.tablas?.find((x) => x.estado === 'PROXIMA') ?? t.tablas?.find((x) => x.estado === 'VIGENTE');
    this.moneda = base?.tramos[0]?.moneda ?? 'BOB';
    this.filas = base
      ? base.tramos.map((r) => ({ etiqueta: r.etiqueta ?? '', desde: r.desde === null || r.desde === undefined ? null : +r.desde,
                                  hasta: r.hasta === null || r.hasta === undefined ? null : +r.hasta, monto: +r.monto }))
      : [{ etiqueta: '', desde: t.calculo === 'POR_ELEMENTOS' ? 1 : 0, hasta: null, monto: null }];
    this.desde = hoy();
    this.tablaVisible = true;
  }

  agregarFila(c: CalculoBono): void {
    const ultima = this.filas[this.filas.length - 1];
    this.filas.push(c === 'POR_ELEMENTOS'
      ? { etiqueta: '', desde: Math.min(9, (ultima?.desde ?? 0) + 1), hasta: null, monto: null }
      : { etiqueta: '', desde: ultima?.hasta ?? null, hasta: null, monto: null });
  }

  tablaValida(): boolean {
    const t = this.enTabla();
    if (!t || !this.desde || this.desde < this.minimo || !this.filas.length) return false;
    return this.filas.every((f) => f.monto !== null && (
      t.calculo === 'TRAMOS_PESO' ? f.desde !== null && (f.hasta === null || f.hasta > f.desde)
      : t.calculo === 'POR_ELEMENTOS' ? f.desde !== null && f.desde >= 1 : true));
  }

  publicar(): void {
    const t = this.enTabla();
    if (!t) return;
    this.guardando.set(true);
    const tramos: TramoBono[] = this.filas.map((f) => ({
      etiqueta: f.etiqueta.trim() || null, desde: f.desde, hasta: t.calculo === 'TRAMOS_PESO' ? f.hasta : null,
      monto: f.monto!, moneda: this.moneda,
    }));
    this.servicio.publicarTablaBono(t.id, this.desde, tramos).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.tablaVisible = false;
        this.toast.add({ severity: 'success', summary: r.mensaje, life: 7000 });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se publicó la tabla', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }

  puedeConfigurar(): boolean { return this.permisos.can('cargas.configurar-bono'); }
}
