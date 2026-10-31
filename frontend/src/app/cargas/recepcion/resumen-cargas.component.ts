import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { abrirPdf, descargar, hoy } from '../../caja/core/archivos';
import { formatoDinero } from '../../caja/core/dinero';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { Opciones, SerieLote } from '../core/models/cargas.model';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';
import { FilaResumen, FiltroResumen, RecepcionService, ResumenCargas } from '../core/services/recepcion.service';
import { SeriesService } from '../core/services/series.service';

/**
 * Tablero y resumen de la carga recibida: por acopio, por tipo (serie), por
 * material, compra o producción propia (y la producción de cada mina propia)
 * y por día. Cada barra lleva su número: el gráfico es también la tabla.
 * Exporta lo mismo en PDF y Excel.
 */
@Component({
  selector: 'app-resumen-cargas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ButtonModule, DropdownModule, InputTextModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <a routerLink="/cargas/lotes" class="volver"><i class="pi pi-arrow-left"></i> Lotes</a>
    <header class="encabezado">
      <div>
        <h2>Resumen de cargas</h2>
        <p class="subtitulo">Lo recibido en el período, clasificado por acopio, tipo de carga, material y origen. Peso que vale (húmedo); los lotes anulados no cuentan.</p>
      </div>
      <div class="acciones">
        <p-button label="PDF" icon="pi pi-file-pdf" [outlined]="true" [loading]="bajando() === 'pdf'" (onClick)="archivo('pdf')" />
        <p-button label="Excel" icon="pi pi-file-excel" [outlined]="true" [loading]="bajando() === 'excel'" (onClick)="archivo('excel')" />
      </div>
    </header>

    <!-- Filtros: una fila, arriba de todo -->
    <div class="barra filtros">
      <div class="periodos">
        <button type="button" *ngFor="let p of periodos" [class.activo]="periodo === p.valor" (click)="usarPeriodo(p.valor)">{{ p.etiqueta }}</button>
      </div>
      <input pInputText type="date" [(ngModel)]="f.desde" (change)="periodo = ''; cargar()" aria-label="Desde" />
      <input pInputText type="date" [(ngModel)]="f.hasta" (change)="periodo = ''; cargar()" aria-label="Hasta" />
      <p-dropdown *ngIf="(opciones()?.acopios?.length ?? 0) > 1" [options]="opciones()?.acopios ?? []" [(ngModel)]="f.almacen_id"
                  optionLabel="nombre" optionValue="id" placeholder="Todos los acopios" [showClear]="true" (onChange)="cargar()" />
      <p-dropdown [options]="series()" [(ngModel)]="f.serie_id" optionLabel="nombre" optionValue="id" placeholder="Todos los tipos"
                  [showClear]="true" (onChange)="cargar()" />
      <p-dropdown [options]="materiales()" [(ngModel)]="f.material" optionLabel="etiqueta" optionValue="valor" placeholder="Todo material"
                  [showClear]="true" (onChange)="cargar()" />
      <p-dropdown [options]="origenes" [(ngModel)]="f.origen" optionLabel="etiqueta" optionValue="valor" placeholder="Compra y propia"
                  [showClear]="true" (onChange)="cargar()" />
    </div>

    <ng-container *ngIf="r() as d">
      <!-- Cifras principales -->
      <section class="cifras">
        <div class="cifra"><span class="rotulo">Kilos recibidos</span><span class="valor">{{ fmt(d.totales.kg) }}</span><span class="pie-cifra">peso que vale, húmedo</span></div>
        <div class="cifra"><span class="rotulo">Lotes</span><span class="valor">{{ d.totales.lotes }}</span>
          <span class="pie-cifra">{{ d.totales.lotes ? fmt(d.totales.kg / d.totales.lotes) + ' kg por lote' : '—' }}</span></div>
        <div class="cifra"><span class="rotulo">Producción propia</span><span class="valor">{{ fmt(kgPropia()) }}</span>
          <span class="pie-cifra">{{ d.totales.lotes_propios }} lote{{ d.totales.lotes_propios === 1 ? '' : 's' }} · {{ pct(kgPropia(), d.totales.kg) }} del total</span></div>
      </section>

      <div class="vacio" *ngIf="!d.totales.lotes">
        <i class="pi pi-inbox"></i><div class="titulo-vacio">No hay carga recibida con esos filtros</div>
        <span>Pruebe con otro período o quite algún filtro.</span>
      </div>

      <ng-container *ngIf="d.totales.lotes">
        <!-- Por día -->
        <section class="panel">
          <div class="panel-cabeza"><h3>Kilos recibidos por día</h3>
            <button type="button" class="enlace" (click)="verTablaDias = !verTablaDias">{{ verTablaDias ? 'Ver gráfico' : 'Ver tabla' }}</button></div>
          <ng-container *ngIf="!verTablaDias; else tablaDias">
            <div class="dias" role="img" [attr.aria-label]="'Kilos por día, ' + d.por_dia.length + ' días con carga'">
              <div class="dia" *ngFor="let x of dias()" [class.vacio-dia]="!x.kg" (mouseenter)="diaActivo.set(x)" (mouseleave)="diaActivo.set(null)"
                   [class.activo]="diaActivo()?.fecha === x.fecha" tabindex="0" (focus)="diaActivo.set(x)" (blur)="diaActivo.set(null)">
                <div class="columna" [style.height.%]="altura(x.kg)"></div>
              </div>
            </div>
            <div class="eje">
              <span>{{ dias().at(0)?.fecha | date: 'dd/MM' }}</span><span>{{ dias().at(-1)?.fecha | date: 'dd/MM' }}</span>
            </div>
            <div class="lectura">
              <ng-container *ngIf="diaActivo() as x; else maximo">
                <b>{{ x.fecha | date: 'EEEE dd/MM' }}</b>: {{ fmt(x.kg) }} kg en {{ x.lotes }} lote{{ x.lotes === 1 ? '' : 's' }}
              </ng-container>
              <ng-template #maximo><span class="secundario">Día con más carga: <b>{{ diaMax()?.fecha | date: 'dd/MM' }}</b>, {{ fmt(diaMax()?.kg ?? 0) }} kg.
                Pase el cursor sobre un día para ver su detalle.</span></ng-template>
            </div>
          </ng-container>
          <ng-template #tablaDias>
            <table class="tabla-simple"><thead><tr><th>Fecha</th><th class="num">Lotes</th><th class="num">Kg</th></tr></thead>
              <tbody><tr *ngFor="let x of d.por_dia"><td>{{ x.fecha | date: 'dd/MM/yyyy' }}</td><td class="num">{{ x.lotes }}</td><td class="num">{{ fmt(x.kg) }}</td></tr></tbody></table>
          </ng-template>
        </section>

        <!-- Clasificaciones -->
        <div class="rejilla">
          <section class="panel" *ngFor="let g of grupos()">
            <h3>{{ g.titulo }}</h3>
            <div class="barras">
              <div class="fila-barra" *ngFor="let x of g.filas" [attr.title]="x.etiqueta + ': ' + fmt(x.kg) + ' kg en ' + x.lotes + ' lotes'">
                <span class="etiqueta">{{ x.etiqueta }}</span>
                <span class="pista"><span class="barra-valor" [style.width.%]="ancho(x.kg, g.max)"></span></span>
                <span class="numero"><b>{{ fmt(x.kg) }}</b> kg <span class="secundario">· {{ x.lotes }} · {{ pct(x.kg, d.totales.kg) }}</span></span>
              </div>
            </div>
          </section>
        </div>

        <section class="panel" *ngIf="d.produccion_propia.length">
          <h3>Producción de minas propias</h3>
          <table class="tabla-simple">
            <thead><tr><th>Mina</th><th>Bocamina</th><th class="num">Lotes</th><th class="num">Kg</th></tr></thead>
            <tbody><tr *ngFor="let x of d.produccion_propia"><td>{{ x.mina ?? '—' }}</td><td class="codigo">{{ x.bocamina ?? '—' }}</td>
              <td class="num">{{ x.lotes }}</td><td class="num">{{ fmt(x.kg) }}</td></tr></tbody>
          </table>
        </section>
      </ng-container>
    </ng-container>
  `,
  styles: [ESTILOS_CARGAS, `
    .volver { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; margin-bottom: 0.6rem;
              color: var(--text-color-secondary, #6b7280); text-decoration: none; }
    .filtros { flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; align-items: center; }
    .periodos { display: inline-flex; border: 1px solid var(--surface-border, #d1d5db); border-radius: 8px; overflow: hidden; }
    .periodos button { border: 0; background: var(--surface-card, #fff); padding: 0.45rem 0.75rem; cursor: pointer; font: inherit; font-size: 0.85rem;
                       color: var(--text-color, #111827); }
    .periodos button + button { border-left: 1px solid var(--surface-border, #d1d5db); }
    .periodos button.activo { background: var(--primary-color, #2563eb); color: #fff; }
    .cifras { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.8rem; margin-bottom: 1rem; }
    @media (max-width: 720px) { .cifras { grid-template-columns: 1fr; } }
    .cifra { text-align: left; border: 1px solid var(--surface-border, #e5e7eb); border-radius: 10px; padding: 0.8rem 1rem; background: var(--surface-card, #fff);
             display: flex; flex-direction: column; gap: 0.15rem; }
    .cifra .rotulo { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-color-secondary, #6b7280); }
    .cifra .valor { font-size: 1.6rem; font-weight: 700; font-family: ui-monospace, 'SF Mono', Menlo, monospace; color: var(--text-color, #111827); }
    .cifra .pie-cifra { font-size: 0.8rem; color: var(--text-color-secondary, #6b7280); }
    .panel { border: 1px solid var(--surface-border, #e5e7eb); border-radius: 10px; padding: 0.9rem 1rem; background: var(--surface-card, #fff); margin-bottom: 1rem; }
    .panel h3 { margin: 0 0 0.7rem; font-size: 0.95rem; }
    .panel-cabeza { display: flex; justify-content: space-between; align-items: baseline; }
    .enlace { border: 0; background: none; color: var(--primary-color, #2563eb); cursor: pointer; font: inherit; font-size: 0.82rem; padding: 0; }
    .rejilla { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 1rem; }
    @media (max-width: 900px) { .rejilla { grid-template-columns: 1fr; } }
    .barras { display: flex; flex-direction: column; gap: 0.45rem; }
    .fila-barra { display: grid; grid-template-columns: minmax(6rem, 10rem) 1fr auto; gap: 0.6rem; align-items: center; font-size: 0.85rem; }
    .etiqueta { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pista { height: 0.75rem; display: block; }
    .barra-valor { display: block; height: 100%; min-width: 2px; background: var(--primary-color, #2563eb); border-radius: 0 4px 4px 0; }
    .fila-barra:hover .barra-valor { filter: brightness(0.85); }
    .numero { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 0.8rem; white-space: nowrap; }
    .dias { display: flex; align-items: flex-end; gap: 2px; height: 9rem; border-bottom: 1px solid var(--surface-border, #d1d5db); }
    .dia { flex: 1; height: 100%; display: flex; align-items: flex-end; cursor: default; outline: none; padding-top: 4px; }
    .columna { width: 100%; background: var(--primary-color, #2563eb); border-radius: 4px 4px 0 0; min-height: 0; opacity: 0.85; }
    .dia.activo .columna, .dia:focus .columna { opacity: 1; filter: brightness(0.85); }
    .dia.vacio-dia .columna { min-height: 0; }
    .eje { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-color-secondary, #6b7280); margin-top: 0.25rem; }
    .lectura { font-size: 0.85rem; margin-top: 0.5rem; min-height: 1.3rem; }
    .tabla-simple { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
    .tabla-simple th { text-align: left; font-size: 0.7rem; text-transform: uppercase; color: var(--text-color-secondary, #6b7280); padding: 0.3rem;
                       border-bottom: 1px solid var(--surface-border, #e5e7eb); }
    .tabla-simple td { padding: 0.35rem 0.3rem; border-bottom: 1px solid var(--surface-border, #f1f5f9); }
    .num { text-align: right !important; font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
    .secundario { color: var(--text-color-secondary, #6b7280); }
    .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
  `],
})
export class ResumenCargasComponent implements OnInit {
  private readonly servicio = inject(RecepcionService);
  private readonly catalogos = inject(CatalogosCargasService);
  private readonly seriesSrv = inject(SeriesService);
  private readonly toast = inject(MessageService);

  readonly r = signal<ResumenCargas | null>(null);
  readonly opciones = signal<Opciones | null>(null);
  readonly series = signal<SerieLote[]>([]);
  readonly bajando = signal<'pdf' | 'excel' | null>(null);
  readonly diaActivo = signal<{ fecha: string; kg: number; lotes: number } | null>(null);
  readonly fmt = formatoDinero;
  readonly origenes = [{ valor: 'COMPRA', etiqueta: 'Compra' }, { valor: 'PROPIA', etiqueta: 'Producción propia' }];
  readonly periodos = [{ valor: 'mes', etiqueta: 'Este mes' }, { valor: 'anterior', etiqueta: 'Mes anterior' },
                       { valor: '30', etiqueta: '30 días' }, { valor: 'anio', etiqueta: 'Este año' }];
  periodo = 'mes';
  verTablaDias = false;
  f: FiltroResumen = { desde: '', hasta: hoy(), almacen_id: null, serie_id: null, material: null, origen: null };

  materiales() { return [...(this.opciones()?.materiales ?? []), { valor: 'SIN', etiqueta: 'Sin material' }]; }

  readonly kgPropia = computed(() => this.r()?.por_origen.find((x) => x.clave === 'PROPIA')?.kg ?? 0);

  /** Cada clasificación con su máximo (las barras son proporcionales dentro del panel). */
  readonly grupos = computed(() => {
    const d = this.r();
    if (!d) return [];
    const g = (titulo: string, filas: FilaResumen[], etiqueta: (x: FilaResumen) => string) => ({
      titulo, filas: filas.map((x) => ({ ...x, etiqueta: etiqueta(x) })), max: Math.max(1, ...filas.map((x) => x.kg)),
    });
    return [
      g('Por acopio', d.por_acopio, (x) => x.nombre),
      g('Por tipo de carga', d.por_tipo, (x) => `${x.clave} · ${x.nombre}`),
      g('Por material', d.por_material, (x) => x.nombre),
      g('Compra y producción propia', d.por_origen, (x) => x.nombre),
    ];
  });

  /** Todos los días del período (los sin carga en cero), para que el eje no salte. */
  readonly dias = computed(() => {
    const d = this.r();
    if (!d) return [];
    const porFecha = new Map(d.por_dia.map((x) => [x.fecha.slice(0, 10), x]));
    const out: { fecha: string; kg: number; lotes: number }[] = [];
    const ini = new Date(this.f.desde + 'T12:00:00'), fin = new Date(this.f.hasta + 'T12:00:00');
    for (let t = ini; t <= fin && out.length < 400; t = new Date(t.getTime() + 86400000)) {
      const k = t.toISOString().slice(0, 10);
      out.push(porFecha.get(k) ?? { fecha: k, kg: 0, lotes: 0 });
    }
    return out;
  });
  readonly diaMax = computed(() => this.dias().reduce<{ fecha: string; kg: number; lotes: number } | null>((m, x) => (!m || x.kg > m.kg ? x : m), null));

  ngOnInit(): void {
    this.catalogos.opciones$.subscribe((o) => this.opciones.set(o));
    this.seriesSrv.listar().subscribe((r) => this.series.set(r.data));
    this.usarPeriodo('mes');
  }

  usarPeriodo(p: string): void {
    this.periodo = p;
    const h = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (p === 'mes') { this.f.desde = iso(new Date(h.getFullYear(), h.getMonth(), 1)); this.f.hasta = iso(h); }
    if (p === 'anterior') { this.f.desde = iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)); this.f.hasta = iso(new Date(h.getFullYear(), h.getMonth(), 0)); }
    if (p === '30') { this.f.desde = iso(new Date(h.getTime() - 29 * 86400000)); this.f.hasta = iso(h); }
    if (p === 'anio') { this.f.desde = iso(new Date(h.getFullYear(), 0, 1)); this.f.hasta = iso(h); }
    this.cargar();
  }

  cargar(): void {
    if (!this.f.desde || !this.f.hasta) return;
    this.servicio.resumen(this.f).subscribe({
      next: (d) => this.r.set(d),
      error: (e) => this.toast.add({ severity: 'error', summary: 'No se pudo cargar el resumen', detail: mensajeDeError(e), life: 9000 }),
    });
  }

  archivo(formato: 'pdf' | 'excel'): void {
    this.bajando.set(formato);
    this.servicio.resumenArchivo(this.f, formato).subscribe({
      next: (b) => {
        this.bajando.set(null);
        formato === 'pdf' ? abrirPdf(b) : descargar(b, `resumen-de-cargas-${this.f.desde}-a-${this.f.hasta}.xlsx`);
      },
      error: (e) => { this.bajando.set(null); this.toast.add({ severity: 'error', summary: 'No se pudo generar el archivo', detail: mensajeDeError(e) }); },
    });
  }

  ancho(kg: number, max: number): number { return Math.max(0.5, (kg / max) * 100); }
  altura(kg: number): number { const m = this.diaMax()?.kg || 1; return kg ? Math.max(2, (kg / m) * 100) : 0; }
  pct(parte: number, total: number): string { return total ? `${Math.round((parte / total) * 1000) / 10} %` : '—'; }
}
