import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { Observable } from 'rxjs';
import { hoy, nombreDe } from '../../caja/core/archivos';
import { formatoDinero } from '../../caja/core/dinero';
import { PermisosService } from '../../core/services/permisos.service';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { LineaProducto, TablaPrecio } from '../core/models/cargas.model';
import { aNumero, aTexto, formatoLey, numeroInvalido } from '../core/numeros';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';
import { PreciosService } from '../core/services/precios.service';

interface FilaTramo { ley_desde: string; ley_hasta: string; valor: string; }

/**
 * Tablas de precio por línea y elemento. Se arman en borrador, las aprueba
 * otra persona y no se editan después: se copian para armar la que las
 * reemplaza desde una fecha.
 */
@Component({
  selector: 'app-tablas-precio',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, DropdownModule, InputTextModule, TableModule, ToastModule, TooltipModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <header class="encabezado">
      <div>
        <h2>Tablas de precio</h2>
        <p class="subtitulo">Cuánto se paga por TM según la ley. Una tabla se arma en borrador y la aprueba otra persona; la base
          rechaza huecos entre tramos y tramos donde una ley mayor pague menos.</p>
      </div>
      <div class="acciones" *ngIf="puede('cargas.precios-editar')">
        <p-button label="Nueva tabla" icon="pi pi-plus" (onClick)="nueva()" />
      </div>
    </header>

    <div class="barra">
      <p-dropdown class="filtro" [options]="lineasConTabla()" [(ngModel)]="filtro.linea_id" optionLabel="nombre" optionValue="id"
                  placeholder="Todas las líneas" [showClear]="true" (onChange)="cargar()" />
      <p-dropdown class="filtro" [options]="estados" [(ngModel)]="filtro.estado" optionLabel="etiqueta" optionValue="valor"
                  placeholder="Todos los estados" [showClear]="true" (onChange)="cargar()" />
    </div>

    <p-table [value]="tablas()" [loading]="cargando()" dataKey="id" styleClass="p-datatable-sm tabla">
      <ng-template pTemplate="header">
        <tr><th>Línea</th><th style="width: 7rem">Elemento</th><th style="width: 9rem">Modalidad</th><th style="width: 13rem">Vigencia</th>
            <th style="width: 6rem" class="derecha">Tramos</th><th style="width: 12rem">Armó / aprobó</th><th style="width: 8rem">Estado</th>
            <th style="width: 12rem"></th></tr>
      </ng-template>
      <ng-template pTemplate="body" let-t>
        <tr [class.inactiva]="t.situacion === 'ANULADA' || t.situacion === 'ANTERIOR'">
          <td>{{ t.linea?.nombre }}<div class="secundario" *ngIf="t.descripcion">{{ t.descripcion }}</div></td>
          <td><b>{{ t.elemento?.codigo }}</b> <span class="secundario">{{ t.elemento?.unidad_ley }}</span></td>
          <td>{{ t.modalidad === 'POR_PUNTO' ? 'Por punto' : 'Por porcentaje' }} · {{ t.moneda }}</td>
          <td>{{ t.vigente_desde | date: 'dd/MM/yyyy' }} → {{ t.vigente_hasta ? (t.vigente_hasta | date: 'dd/MM/yyyy') : 'sin cierre' }}</td>
          <td class="derecha">{{ t.tramos_count }}</td>
          <td>{{ nombre(t.creado_por) }}<div class="secundario">{{ t.aprobado_por ? 'aprobó ' + nombre(t.aprobado_por) : 'sin aprobar' }}</div></td>
          <td><span class="pastilla" [ngClass]="'s-' + t.situacion.toLowerCase()">{{ etiquetaSituacion(t.situacion) }}</span></td>
          <td class="acciones-fila">
            <p-button [icon]="t.estado === 'BORRADOR' && puede('cargas.precios-editar') ? 'pi pi-pencil' : 'pi pi-eye'" [text]="true" [rounded]="true"
                      size="small" [pTooltip]="t.estado === 'BORRADOR' ? 'Abrir borrador' : 'Ver tramos'" (onClick)="abrir(t)" />
            <p-button *ngIf="t.estado === 'BORRADOR' && puede('cargas.precios-aprobar')" icon="pi pi-check" [text]="true" [rounded]="true"
                      size="small" severity="success" pTooltip="Aprobar" (onClick)="aprobar(t)" />
            <p-button *ngIf="t.estado === 'APROBADA' && puede('cargas.precios-editar')" icon="pi pi-copy" [text]="true" [rounded]="true"
                      size="small" pTooltip="Copiar para armar la que la reemplaza" (onClick)="copiar(t)" />
            <p-button *ngIf="t.estado === 'BORRADOR' && puede('cargas.precios-editar')" icon="pi pi-trash" [text]="true" [rounded]="true"
                      size="small" severity="danger" pTooltip="Eliminar borrador" (onClick)="eliminar(t)" />
            <p-button *ngIf="t.situacion === 'PROXIMA' && puede('cargas.precios-aprobar')" icon="pi pi-ban" [text]="true" [rounded]="true"
                      size="small" severity="danger" pTooltip="Anular (todavía no rige)" (onClick)="anular(t)" />
          </td>
        </tr>
      </ng-template>
      <ng-template pTemplate="emptymessage">
        <tr><td colspan="8"><div class="vacio"><i class="pi pi-dollar"></i><div class="titulo-vacio">No hay tablas de precio</div>
          <span>Sin tabla aprobada, el valor estimado de los lotes queda en blanco.</span></div></td></tr>
      </ng-template>
    </p-table>

    <!-- Editor / vista -->
    <p-dialog [(visible)]="editorVisible" [header]="titulo()" [modal]="true" [style]="{ width: '56rem' }" [draggable]="false">
      <div class="campos">
        <div class="campo span-3"><label>Línea</label>
          <p-dropdown [options]="lineasConTabla()" [(ngModel)]="form.linea_producto_id" optionLabel="nombre" optionValue="id" appendTo="body"
                      placeholder="Línea de producto" [disabled]="soloLectura()" (onChange)="form.elemento_id = null; tocar()" /></div>
        <div class="campo span-1"><label>Elemento</label>
          <p-dropdown [options]="pagables()" [(ngModel)]="form.elemento_id" optionLabel="codigo" optionValue="id" appendTo="body"
                      placeholder="—" [disabled]="soloLectura()" /></div>
        <div class="campo span-1"><label>Moneda</label>
          <p-dropdown [options]="['BOB', 'USD']" [(ngModel)]="form.moneda" appendTo="body" [disabled]="soloLectura()" /></div>
        <div class="campo span-1"><label>Rige desde</label>
          <input pInputText type="date" [(ngModel)]="form.vigente_desde" [disabled]="soloLectura()" /></div>
        <div class="campo span-2" *ngIf="modalidad() === 'POR_PORCENTAJE'"><label>Factor de conversión</label>
          <input pInputText inputmode="decimal" [(ngModel)]="form.factor" [disabled]="soloLectura()" (ngModelChange)="tocar()" [class.ng-invalid]="mal(form.factor, 6)"
                 [class.ng-dirty]="mal(form.factor, 6)" />
          <small class="secundario">Lleva ley × % pagable a la unidad de la cotización por TM.</small></div>
        <div class="campo" [ngClass]="modalidad() === 'POR_PORCENTAJE' ? 'span-4' : 'span-6'"><label>Descripción</label>
          <input pInputText [(ngModel)]="form.descripcion" maxlength="200" [disabled]="soloLectura()" placeholder="Opcional" /></div>
      </div>

      <p class="secundario modalidad" *ngIf="modalidad()">
        {{ modalidad() === 'POR_PUNTO' ? 'Por punto: valor por TM = ley × precio por punto.'
          : 'Por porcentaje: valor por TM = ley × % pagable × cotización × factor.' }}
        Cada tramo va desde su ley (incluida) hasta la siguiente (sin incluirla); el último puede quedar abierto.
        <span *ngIf="cotizacion() as c"> Vista previa con la cotización {{ c.tipo.toLowerCase() }} de la {{ c.periodo }}: {{ c.valor }} {{ c.unidad }}.</span>
      </p>

      <table class="tramos">
        <thead><tr><th>Ley desde</th><th>Ley hasta</th><th>{{ modalidad() === 'POR_PORCENTAJE' ? '% pagable' : 'Precio por punto' }}</th>
                   <th class="derecha">Valor por TM</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let f of filas; let i = index" [class.alerta]="avisos()[i]">
            <td><input pInputText inputmode="decimal" [(ngModel)]="f.ley_desde" [disabled]="soloLectura()" [class.ng-invalid]="mal(f.ley_desde)"
                       [class.ng-dirty]="mal(f.ley_desde)" (ngModelChange)="tocar()" /></td>
            <td><input pInputText inputmode="decimal" [(ngModel)]="f.ley_hasta" [disabled]="soloLectura()" placeholder="en adelante"
                       [class.ng-invalid]="mal(f.ley_hasta)" [class.ng-dirty]="mal(f.ley_hasta)" (ngModelChange)="tocar()" /></td>
            <td><input pInputText inputmode="decimal" [(ngModel)]="f.valor" [disabled]="soloLectura()" [class.ng-invalid]="mal(f.valor)"
                       [class.ng-dirty]="mal(f.valor)" (ngModelChange)="tocar()" /></td>
            <td class="derecha monto">{{ previa()[i] }}<div class="aviso-tramo" *ngIf="avisos()[i]">{{ avisos()[i] }}</div></td>
            <td><p-button *ngIf="!soloLectura()" icon="pi pi-trash" [text]="true" [rounded]="true" size="small" severity="danger"
                          [disabled]="filas.length === 1" (onClick)="filas.splice(i, 1); tocar()" /></td>
          </tr>
        </tbody>
      </table>
      <p-button *ngIf="!soloLectura()" label="Agregar tramo" icon="pi pi-plus" [text]="true" size="small" (onClick)="agregar()" />

      <ng-template pTemplate="footer">
        <p-button label="Cerrar" [text]="true" (onClick)="editorVisible = false" />
        <p-button *ngIf="!soloLectura()" label="Guardar borrador" icon="pi pi-save" [loading]="guardando()" [disabled]="!valido()" (onClick)="guardar()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CARGAS, `
    .acciones-fila { white-space: nowrap; text-align: right; }
    .s-vigente { background: #dcfce7; color: #166534; } .s-proxima { background: #e0f2fe; color: #075985; }
    .s-borrador { background: #fef3c7; color: #92400e; } .s-anulada, .s-anterior { background: #f3f4f6; color: #6b7280; }
    .modalidad { font-size: 0.82rem; margin: 0.8rem 0 0.4rem; }
    .tramos { width: 100%; border-collapse: collapse; }
    .tramos th { text-align: left; font-size: 0.7rem; text-transform: uppercase; color: var(--text-color-secondary, #6b7280); padding: 0.3rem; }
    .tramos td { padding: 0.25rem 0.3rem; vertical-align: top; }
    .tramos input { width: 100%; }
    .tramos .derecha, .tramos th.derecha { text-align: right; }
    .monto { font-family: ui-monospace, 'SF Mono', Menlo, monospace; white-space: nowrap; padding-top: 0.6rem !important; }
    tr.alerta td { background: #fef2f2; }
    .aviso-tramo { color: #b91c1c; font-family: inherit; font-size: 0.75rem; white-space: normal; }
  `],
})
export class TablasPrecioComponent implements OnInit {
  private readonly servicio = inject(PreciosService);
  private readonly catalogos = inject(CatalogosCargasService);
  private readonly permisos = inject(PermisosService);
  private readonly toast = inject(MessageService);

  readonly tablas = signal<TablaPrecio[]>([]);
  readonly lineas = signal<LineaProducto[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly abierta = signal<TablaPrecio | null>(null);
  readonly version = signal(0);
  readonly nombre = nombreDe;
  readonly estados = [
    { valor: 'BORRADOR', etiqueta: 'Borradores' }, { valor: 'APROBADA', etiqueta: 'Aprobadas' }, { valor: 'ANULADA', etiqueta: 'Anuladas' },
  ];
  readonly lineasConTabla = computed(() => this.lineas().filter((l) => ['POR_PUNTO', 'POR_PORCENTAJE'].includes(l.modalidad_precio)));

  filtro: { linea_id: number | null; estado: string | null } = { linea_id: null, estado: null };
  editorVisible = false;
  form = this.vacio();
  filas: FilaTramo[] = [];

  readonly soloLectura = computed(() => { const t = this.abierta(); this.version(); return !!t && (t.estado !== 'BORRADOR' || !this.puede('cargas.precios-editar')); });
  readonly cotizacion = computed(() => this.abierta()?.vista_previa?.cotizacion ?? null);

  ngOnInit(): void {
    this.catalogos.listarLineas().subscribe((l) => this.lineas.set(l));
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.servicio.tablas(this.filtro).subscribe({
      next: (t) => { this.tablas.set(t); this.cargando.set(false); },
      error: (e) => { this.cargando.set(false); this.error('No se pudo cargar las tablas', e); },
    });
  }

  puede(p: string): boolean { return this.permisos.can(p); }
  mal(v: string | null | undefined, d = 4): boolean { return numeroInvalido(v, d); }
  etiquetaSituacion(s: string): string {
    return ({ BORRADOR: 'Borrador', VIGENTE: 'Vigente', PROXIMA: 'Próxima', ANTERIOR: 'Anterior', ANULADA: 'Anulada' } as Record<string, string>)[s] ?? s;
  }
  titulo(): string {
    const t = this.abierta();
    if (!t) return 'Nueva tabla de precios';
    return `${t.linea?.nombre ?? ''} · ${t.elemento?.codigo ?? ''} — ${this.etiquetaSituacion(t.situacion).toLowerCase()}`;
  }

  modalidad(): string | null { return this.lineas().find((l) => l.id === this.form.linea_producto_id)?.modalidad_precio ?? null; }
  pagables() {
    const l = this.lineas().find((x) => x.id === this.form.linea_producto_id);
    return (l?.elementos ?? []).filter((e) => e.rol === 'PAGABLE').map((e) => ({ id: e.elemento_id, codigo: e.elemento?.codigo ?? '' }));
  }

  private vacio() {
    return { linea_producto_id: null as number | null, elemento_id: null as number | null, moneda: 'BOB',
             factor: '', descripcion: '', vigente_desde: hoy() };
  }

  nueva(): void {
    this.abierta.set(null);
    this.form = this.vacio();
    this.filas = [{ ley_desde: '', ley_hasta: '', valor: '' }];
    this.tocar();
    this.editorVisible = true;
  }

  abrir(t: TablaPrecio): void {
    this.servicio.tabla(t.id).subscribe({
      next: (d) => {
        this.abierta.set(d);
        this.form = { linea_producto_id: d.linea_producto_id, elemento_id: d.elemento_id, moneda: d.moneda,
                      factor: aTexto(d.factor_conversion), descripcion: d.descripcion ?? '', vigente_desde: d.vigente_desde };
        this.filas = (d.tramos ?? []).map((x) => ({ ley_desde: aTexto(x.ley_desde), ley_hasta: aTexto(x.ley_hasta),
                                                    valor: aTexto(d.modalidad === 'POR_PUNTO' ? x.precio_punto : x.porcentaje_pagable) }));
        this.tocar();
        this.editorVisible = true;
      },
      error: (e) => this.error('No se pudo abrir la tabla', e),
    });
  }

  agregar(): void {
    const ultima = this.filas[this.filas.length - 1];
    this.filas.push({ ley_desde: ultima?.ley_hasta ?? '', ley_hasta: '', valor: '' });
    this.tocar();
  }

  /** Fuerza el recálculo de la vista previa (las filas se editan con ngModel). */
  tocar(): void { this.version.update((v) => v + 1); }

  /** Valor por TM al inicio y fin de cada tramo. Por porcentaje necesita la cotización (llega al abrir una tabla guardada). */
  readonly previa = computed(() => {
    this.version();
    const m = this.modalidad();
    const cot = this.cotizacion();
    const factor = aNumero(this.form.factor, 6);
    return this.filas.map((f) => {
      const d = aNumero(f.ley_desde), h = aNumero(f.ley_hasta), v = aNumero(f.valor, m === 'POR_PORCENTAJE' ? 3 : 4);
      if (d === null || v === null) return '—';
      const valor = (ley: number) => m === 'POR_PUNTO' ? ley * v : (cot && factor ? ley * v / 100 * +cot.valor * factor : null);
      const a = valor(d), b = h === null ? null : valor(h);
      if (a === null) return 'con cotización';
      return `${formatoDinero(a)} → ${b === null ? 'en adelante' : formatoDinero(b)}`;
    });
  });

  /** Lo que la base va a rechazar al aprobar, visto antes: huecos, solapes y tramos que pagan menos. */
  readonly avisos = computed(() => {
    this.version();
    const m = this.modalidad();
    return this.filas.map((f, i) => {
      if (i === 0) return '';
      const p = this.filas[i - 1];
      const ph = aNumero(p.ley_hasta), d = aNumero(f.ley_desde), pv = aNumero(p.valor), v = aNumero(f.valor);
      if (ph === null) return aNumero(p.ley_desde) !== null ? 'El tramo anterior no tiene «hasta»: solo el último queda abierto.' : '';
      if (d !== null && d > ph) return `Hueco: falta el tramo de ${formatoLey(ph)} a ${formatoLey(d)}.`;
      if (d !== null && d < ph) return 'Se superpone con el tramo anterior.';
      if (pv !== null && v !== null && v < pv) return `Paga ${m === 'POR_PORCENTAJE' ? 'menos %' : 'menos por punto'} que el tramo anterior: una ley mayor valdría menos.`;
      return '';
    });
  });

  valido(): boolean {
    this.version();
    const f = this.form;
    if (!f.linea_producto_id || !f.elemento_id || !f.vigente_desde) return false;
    if (this.modalidad() === 'POR_PORCENTAJE' && aNumero(f.factor, 6) === null) return false;
    return this.filas.length > 0 && this.filas.every((x) => aNumero(x.ley_desde) !== null && aNumero(x.valor) !== null && !numeroInvalido(x.ley_hasta));
  }

  guardar(): void {
    const m = this.modalidad();
    const datos = {
      linea_producto_id: this.form.linea_producto_id!, elemento_id: this.form.elemento_id!, moneda: this.form.moneda,
      factor_conversion: m === 'POR_PORCENTAJE' ? aNumero(this.form.factor, 6) : null,
      descripcion: this.form.descripcion || null, vigente_desde: this.form.vigente_desde,
      tramos: this.filas.map((x) => ({ ley_desde: aNumero(x.ley_desde), ley_hasta: aNumero(x.ley_hasta),
        precio_punto: m === 'POR_PUNTO' ? aNumero(x.valor) : null, porcentaje_pagable: m === 'POR_PORCENTAJE' ? aNumero(x.valor, 3) : null })),
    };
    this.enviar(this.servicio.guardar(datos, this.abierta()?.id), () => (this.editorVisible = false));
  }

  aprobar(t: TablaPrecio): void { this.enviar(this.servicio.aprobar(t.id)); }
  anular(t: TablaPrecio): void { this.enviar(this.servicio.anular(t.id)); }
  eliminar(t: TablaPrecio): void { this.enviar(this.servicio.eliminar(t.id)); }
  copiar(t: TablaPrecio): void {
    this.guardando.set(true);
    this.servicio.copiar(t.id).subscribe({
      next: (r) => { this.guardando.set(false); this.toast.add({ severity: 'success', summary: r.mensaje, life: 7000 }); this.cargar(); this.abrir(r.data); },
      error: (e) => { this.guardando.set(false); this.error('No se pudo copiar', e); },
    });
  }

  private enviar(pedido: Observable<{ mensaje: string }>, alTerminar?: () => void): void {
    this.guardando.set(true);
    pedido.subscribe({
      next: (r) => { this.guardando.set(false); alTerminar?.(); this.toast.add({ severity: 'success', summary: r.mensaje, life: 7000 }); this.cargar(); },
      error: (e) => { this.guardando.set(false); this.error('No se pudo completar', e); },
    });
  }

  private error(t: string, e: unknown): void { this.toast.add({ severity: 'error', summary: t, detail: mensajeDeError(e), life: 10000 }); }
}
