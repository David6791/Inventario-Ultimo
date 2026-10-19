import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Observable } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { abrirPdf, nombreDe } from '../../caja/core/archivos';
import { formatoDinero } from '../../caja/core/dinero';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { DatosPesaje, Lote, Pesaje } from '../core/models/cargas.model';
import { RecepcionService } from '../core/services/recepcion.service';
import { PesajeCamposComponent, grupoPesaje, recordarBascula } from './pesaje-campos.component';
import { LoteLaboratorioComponent } from '../laboratorio/lote-laboratorio.component';
import { LoteValorComponent } from '../precios/lote-valor.component';

/** Ficha del lote: datos de recepción, pesajes con su bono, bitácora, boleta y anulación. */
@Component({
  selector: 'app-lote-ficha',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, ButtonModule, DialogModule, InputNumberModule, InputTextareaModule,
            SelectButtonModule, TableModule, ToastModule, TooltipModule, TienePermisoDirective, PesajeCamposComponent, LoteLaboratorioComponent, LoteValorComponent],
  providers: [MessageService],
  template: `
    <p-toast />
    <a routerLink="/cargas/lotes" class="volver"><i class="pi pi-arrow-left"></i> Lotes</a>

    <ng-container *ngIf="lote() as l">
      <header class="encabezado">
        <div>
          <h2><span class="codigo-lote">{{ l.codigo }}</span>
            <span class="pastilla estado" [ngClass]="'estado-' + l.estado.toLowerCase()">{{ etiquetaEstado(l.estado) }}</span></h2>
          <p class="subtitulo">{{ l.linea?.nombre }} · recibido el {{ l.fecha_recepcion | date: 'dd/MM/yyyy HH:mm' }}
            por {{ nombre(l.registrado_por) }} · {{ l.almacen?.nombre }}</p>
        </div>
        <div class="acciones">
          <p-button label="Boleta" icon="pi pi-print" [outlined]="true" (onClick)="boleta()" />
          <p-button label="Rótulo" icon="pi pi-qrcode" [outlined]="true" (onClick)="rotulo()"
                    pTooltip="Identificación con QR para colocar junto a la carga" tooltipPosition="bottom" />
          <ng-container *ngIf="l.estado === 'RECIBIDO'">
            <p-button *appTienePermiso="'cargas.recibir'" label="Agregar pesaje" icon="pi pi-plus" (onClick)="nuevoPesaje()" />
          </ng-container>
          <ng-container *ngIf="['RECIBIDO','MUESTREADO','ANALIZADO'].includes(l.estado)">
            <p-button *appTienePermiso="'cargas.anular-lote'" label="Anular lote" icon="pi pi-ban" severity="danger" [text]="true"
                      (onClick)="pedirAnulacion(null)" />
          </ng-container>
        </div>
      </header>

      <div class="nota nota-aviso nota-encabezado" *ngIf="l.estado === 'ANULADO'">
        <i class="pi pi-ban"></i>
        <span>Anulado el {{ l.anulado_en | date: 'dd/MM/yyyy HH:mm' }} por {{ nombre(l.anulado_por) }}: {{ l.motivo_anulacion }}</span>
      </div>

      <section class="resumen">
        <div class="dato"><span class="rotulo">{{ l.origen === 'COMPRA' ? 'Productor' : 'Origen' }}</span>
          <span *ngIf="l.productor">{{ l.productor.nombre }}</span><span *ngIf="!l.productor">Producción propia</span>
          <small class="secundario" *ngIf="l.productor">{{ l.productor.ci ? 'CI ' + l.productor.ci : 'NIT ' + l.productor.nit }}</small></div>
        <div class="dato"><span class="rotulo">Cooperativa</span><span>{{ l.cooperativa?.nombre ?? '—' }}</span></div>
        <div class="dato"><span class="rotulo">Mina</span><span>{{ l.mina?.nombre ?? '—' }}</span>
          <small class="secundario" *ngIf="l.bocamina">Bocamina {{ l.bocamina.codigo }}</small></div>
        <div class="dato"><span class="rotulo">Municipio</span><span>{{ l.municipio?.nombre ?? '—' }}</span></div>
        <div class="dato"><span class="rotulo">Material</span><span class="codigo">{{ l.material ?? '—' }}</span></div>
        <div class="dato"><span class="rotulo">Guía</span><span class="codigo">{{ l.guia_transporte ?? '—' }}</span></div>
        <div class="dato grande"><span class="rotulo">Peso neto húmedo</span>
          <span class="monto">{{ kg(l.peso_neto_humedo_kg) }} kg</span>
          <small class="secundario">{{ l.num_pesajes }} pesaje(s){{ l.num_sacos ? ' · ' + l.num_sacos + ' sacos' : '' }}</small></div>
        <div class="dato grande" *ngIf="l.pesajes_con_peso_cliente"><span class="rotulo">Peso del cliente</span>
          <span class="monto">{{ kg(l.peso_cliente_kg) }} kg</span>
          <small [class.alerta]="alerta(l)" class="secundario">Diferencia {{ +l.diferencia_cliente_kg > 0 ? '+' : '' }}{{ kg(l.diferencia_cliente_kg) }} kg
            ({{ pct(l) }} %) · vale el de la empresa</small></div>
        <div class="dato grande"><span class="rotulo">Bono de transporte</span>
          <span class="monto">Bs {{ kg(+l.bonos_pagados + +l.bonos_por_pagar) }}</span>
          <small class="secundario" *ngIf="l.bonos_pendientes">Bs {{ kg(l.bonos_por_pagar) }} por pagar en caja</small>
          <small class="secundario" *ngIf="!l.bonos_pendientes && +l.bonos_pagados">Pagado</small></div>
      </section>
      <p class="secundario observaciones" *ngIf="l.observaciones">{{ l.observaciones }}</p>
      <p class="secundario verificacion" *ngIf="l.url_verificacion">
        <i class="pi pi-qrcode"></i> El QR del rótulo abre
        <a [href]="l.url_verificacion" target="_blank" rel="noopener">la verificación pública</a>, sin iniciar sesión.
      </p>

      <h3 class="titulo-seccion">Pesajes</h3>
      <p-table [value]="l.pesajes ?? []" dataKey="id" styleClass="p-datatable-sm tabla">
        <ng-template pTemplate="header">
          <tr>
            <th style="width: 9rem">Ticket</th>
            <th>Camión y chofer</th>
            <th style="width: 7rem" class="derecha">Bruto kg</th>
            <th style="width: 7rem" class="derecha">Tara kg</th>
            <th style="width: 8rem" class="derecha">Neto kg</th>
            <th style="width: 8rem" class="derecha">Cliente kg</th>
            <th style="width: 11rem">Bono</th>
            <th style="width: 4rem"></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-p>
          <tr [class.anulado]="p.anulado">
            <td>
              <span class="codigo">{{ p.ticket }}</span>
              <span class="pastilla" *ngIf="p.tipo === 'CONTROL'" pTooltip="Repesaje de control: no suma al peso del lote">Control</span>
              <div class="secundario">{{ p.bascula }} · {{ p.fecha | date: 'dd/MM HH:mm' }}</div>
            </td>
            <td>
              {{ p.placa ?? 'Sin placa' }} · {{ p.chofer_nombre ?? '—' }}
              <div class="secundario" *ngIf="p.num_sacos">{{ p.num_sacos }} sacos</div>
              <div class="secundario" *ngIf="p.anulado">Anulado: {{ p.motivo_anulacion }}</div>
            </td>
            <td class="derecha monto">{{ kg(p.peso_bruto_kg) }}</td>
            <td class="derecha monto">{{ kg(p.tara_kg) }}</td>
            <td class="derecha monto fuerte">{{ kg(p.peso_neto_kg) }}</td>
            <td class="derecha monto">
              <ng-container *ngIf="p.peso_cliente_kg !== null; else sinCliente">
                {{ kg(netoCliente(p)) }}
                <div class="secundario" *ngIf="p.peso_cliente_tipo === 'BRUTO'">bruto {{ kg(p.peso_cliente_kg) }}</div>
                <div class="secundario">{{ netoCliente(p) - +p.peso_neto_kg > 0 ? '+' : '' }}{{ kg(netoCliente(p) - +p.peso_neto_kg) }}</div>
              </ng-container>
              <ng-template #sinCliente>—</ng-template>
              <div *ngIf="!p.anulado && l.estado !== 'ANULADO' && l.estado !== 'LIQUIDADO'">
                <button *appTienePermiso="'cargas.recibir'" type="button" class="enlace" (click)="pedirCorreccion(p)">
                  {{ p.peso_cliente_kg === null ? 'Anotar' : 'Corregir' }}</button>
              </div>
              <div class="secundario" *ngIf="p.correcciones_cliente?.length" [pTooltip]="historialCliente(p)">
                <i class="pi pi-history"></i> {{ p.correcciones_cliente!.length }} corrección(es)</div></td>
            <td>
              <ng-container *ngIf="p.bono as b; else sinBono">
                <span class="monto">Bs {{ kg(b.monto) }}</span>
                <span class="pastilla separada" [class.pastilla-aviso]="b.estado === 'PENDIENTE'" [class.pastilla-ok]="b.estado === 'PAGADO'">
                  {{ b.estado === 'PENDIENTE' ? 'Por pagar' : b.estado === 'PAGADO' ? 'Pagado' : 'Anulado' }}</span>
                <div class="secundario" *ngIf="b.movimiento">{{ b.movimiento.numero }}</div>
              </ng-container>
              <ng-template #sinBono><span class="secundario">—</span></ng-template>
            </td>
            <td class="centro">
              <ng-container *ngIf="!p.anulado && (l.estado === 'RECIBIDO' || p.tipo === 'CONTROL') && p.bono?.estado !== 'PAGADO'">
                <p-button *appTienePermiso="'cargas.recibir'" icon="pi pi-ban" [text]="true" [rounded]="true" size="small"
                          severity="danger" pTooltip="Anular pesaje" (onClick)="pedirAnulacion(p)" />
              </ng-container>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="8"><div class="vacio"><i class="pi pi-truck"></i><div class="titulo-vacio">Sin pesajes todavía</div>
            <span>Agregue el pesaje de ingreso cuando el camión pase por la báscula.</span></div></td></tr>
        </ng-template>
      </p-table>

      <app-lote-laboratorio *ngIf="l.estado !== 'ANULADO' || l.num_pesajes" [lote]="l" (cambio)="cargar()" />
      <app-lote-valor *ngIf="l.estado !== 'ANULADO'" [lote]="l" />

      <h3 class="titulo-seccion">Bitácora</h3>
      <ul class="bitacora">
        <li *ngFor="let e of l.eventos">
          <span class="secundario">{{ e.ocurrido_en | date: 'dd/MM/yyyy HH:mm' }}</span>
          <span>{{ e.estado_anterior ? etiquetaEstado(e.estado_anterior) + ' → ' : '' }}<strong>{{ etiquetaEstado(e.estado_nuevo) }}</strong></span>
          <span class="secundario">{{ e.usuario?.name }}{{ e.detalle ? ' · ' + e.detalle : '' }}</span>
        </li>
      </ul>
    </ng-container>

    <!-- Agregar pesaje -->
    <p-dialog [(visible)]="pesajeVisible" header="Agregar pesaje" [modal]="true" [style]="{ width: '46rem' }" [draggable]="false">
      <div class="tipo-pesaje">
        <p-selectButton [options]="tipos" [(ngModel)]="tipoPesaje" optionLabel="etiqueta" optionValue="valor" (onChange)="cambiarTipo()" />
        <small class="secundario">{{ tipoPesaje === 'INGRESO' ? 'Otro camión del mismo lote: suma al peso y genera su bono.' :
          'Repesaje para verificar: no suma al peso ni genera bono.' }}</small>
      </div>
      <app-pesaje-campos [grupo]="pesaje" />
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="pesajeVisible = false" />
        <p-button label="Registrar pesaje" icon="pi pi-check" [loading]="guardando()" [disabled]="pesaje.invalid || guardando()"
                  (onClick)="guardarPesaje()" />
      </ng-template>
    </p-dialog>

    <!-- Anular -->
    <!-- Corregir peso del cliente -->
    <p-dialog [(visible)]="correccionVisible" [header]="'Peso del cliente · ticket ' + (aCorregir()?.ticket ?? '')" [modal]="true"
              [style]="{ width: '32rem' }" [draggable]="false">
      <p class="explicacion">Es informativo: no cambia el peso del lote, el bono ni la liquidación. La corrección queda registrada con su motivo.
        Báscula de la empresa: bruto {{ kg(aCorregir()?.peso_bruto_kg) }}, tara {{ kg(aCorregir()?.tara_kg) }}, neto {{ kg(aCorregir()?.peso_neto_kg) }}.</p>
      <div class="campo">
        <label>Peso que declaró el cliente (kg) <span class="secundario">vacío si no declaró</span></label>
        <p-inputNumber [(ngModel)]="correccion.kg" mode="decimal" locale="es-BO" [maxFractionDigits]="2" [min]="0" />
        <p-selectButton [options]="tiposCliente" [(ngModel)]="correccion.tipo" optionLabel="etiqueta" optionValue="valor" />
      </div>
      <div class="campo">
        <label for="motivo-c">Motivo</label>
        <textarea id="motivo-c" pInputTextarea rows="2" [(ngModel)]="correccion.motivo" maxlength="250"></textarea>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="correccionVisible = false" />
        <p-button label="Corregir" icon="pi pi-check" [loading]="guardando()" [disabled]="correccion.motivo.trim().length < 10 || guardando()"
                  (onClick)="corregir()" />
      </ng-template>
    </p-dialog>

    <p-dialog [(visible)]="anularVisible" [header]="aAnular() ? 'Anular pesaje ' + aAnular()!.ticket : 'Anular lote ' + lote()?.codigo"
              [modal]="true" [style]="{ width: '32rem' }" [draggable]="false">
      <p class="explicacion" *ngIf="aAnular()">El pesaje no se borra: queda tachado y deja de sumar. Si tenía un bono por pagar, se anula con él.</p>
      <p class="explicacion" *ngIf="!aAnular()">El lote queda anulado con su motivo y sus bonos por pagar se anulan. Los bonos ya pagados se mantienen.</p>
      <div class="campo">
        <label for="motivo">Motivo</label>
        <textarea id="motivo" pInputTextarea rows="3" [(ngModel)]="motivo" maxlength="250"></textarea>
        <small>Al menos 10 caracteres.</small>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="anularVisible = false" />
        <p-button label="Anular" icon="pi pi-ban" severity="danger" [loading]="guardando()"
                  [disabled]="motivo.trim().length < 10 || guardando()" (onClick)="anular()" />
      </ng-template>
    </p-dialog>
  `,
  styles: [ESTILOS_CARGAS, `
    .volver { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; margin-bottom: 0.6rem;
              color: var(--text-color-secondary, #6b7280); text-decoration: none; }
    .codigo-lote { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
    .estado { vertical-align: middle; margin-left: 0.5rem; font-size: 0.75rem; }
    .estado-recibido { background: #e0f2fe; color: #075985; }
    .estado-anulado { background: #fee2e2; color: #991b1b; }
    .resumen { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 0.8rem; margin-bottom: 0.6rem; }
    .dato { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.7rem 0.9rem; border: 1px solid var(--surface-border, #e5e7eb);
            border-radius: 8px; background: var(--surface-card, #fff); font-size: 0.9rem; }
    .dato .rotulo { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-color-secondary, #6b7280); }
    .dato.grande .monto { font-size: 1.25rem; font-weight: 700; }
    .monto { font-family: ui-monospace, 'SF Mono', Menlo, monospace; white-space: nowrap; }
    .fuerte { font-weight: 650; }
    .observaciones { margin: 0 0 0.8rem; }
    .titulo-seccion { font-size: 0.95rem; margin: 1.2rem 0 0.5rem; }
    tr.anulado td { color: var(--text-color-secondary, #9ca3af); }
    tr.anulado .monto { text-decoration: line-through; }
    .separada { margin-left: 0.4rem; }
    .verificacion { font-size: 0.82rem; margin: 0 0 0.8rem; display: flex; gap: 0.4rem; align-items: center; }
    .enlace { border: 0; background: none; color: var(--primary-color, #2563eb); cursor: pointer; font-size: 0.78rem; padding: 0; }
    .alerta { color: #b45309; font-weight: 600; }
    .pastilla-ok { background: #dcfce7; color: #166534; }
    .bitacora { list-style: none; margin: 0; padding: 0; font-size: 0.85rem; }
    .bitacora li { display: flex; gap: 1rem; padding: 0.35rem 0; border-top: 1px solid var(--surface-border, #f1f5f9); }
    .tipo-pesaje { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 1rem; }
    .explicacion { font-size: 0.88rem; line-height: 1.5; margin-top: 0; }
    .campo { display: flex; flex-direction: column; gap: 0.35rem; }
    .campo textarea { width: 100%; }
  `],
})
export class LoteFichaComponent implements OnInit {
  readonly id = input.required<string>();

  private readonly servicio = inject(RecepcionService);
  private readonly toast = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  readonly lote = signal<Lote | null>(null);
  readonly guardando = signal(false);
  readonly aAnular = signal<Pesaje | null>(null);
  readonly nombre = nombreDe;
  readonly pesaje = grupoPesaje(this.fb);
  readonly tipos = [{ valor: 'INGRESO', etiqueta: 'Ingreso' }, { valor: 'CONTROL', etiqueta: 'Control' }];

  pesajeVisible = false;
  anularVisible = false;
  correccionVisible = false;
  readonly aCorregir = signal<Pesaje | null>(null);
  correccion: { kg: number | null; tipo: 'NETO' | 'BRUTO'; motivo: string } = { kg: null, tipo: 'NETO', motivo: '' };
  readonly tiposCliente = [{ valor: 'NETO', etiqueta: 'Neto' }, { valor: 'BRUTO', etiqueta: 'Bruto' }];
  tipoPesaje: 'INGRESO' | 'CONTROL' = 'INGRESO';
  motivo = '';

  ngOnInit(): void {
    const mensaje = history.state?.mensaje;
    if (mensaje) setTimeout(() => this.toast.add({ severity: 'success', summary: 'Lote recibido', detail: mensaje, life: 8000 }));
    this.cargar();
  }

  cargar(): void {
    this.servicio.ver(Number(this.id())).subscribe({
      next: (l) => this.lote.set(l),
      error: (e) => this.toast.add({ severity: 'error', summary: 'No se pudo abrir el lote', detail: mensajeDeError(e), life: 10000 }),
    });
  }

  kg(v: string | number | null | undefined): string { return formatoDinero(v); }

  /** Diferencia del cliente en % del peso de la empresa. */
  pct(l: Lote): string {
    const base = +l.peso_neto_humedo_kg;
    return base ? `${+l.diferencia_cliente_kg > 0 ? '+' : ''}${formatoDinero(Math.round((+l.diferencia_cliente_kg / base) * 10000) / 100)}` : '—';
  }

  alerta(l: Lote): boolean {
    const base = +l.peso_neto_humedo_kg;
    return !!base && Math.abs(+l.diferencia_cliente_kg / base) > 0.01;
  }

  etiquetaEstado(e: string): string {
    return ({ RECIBIDO: 'Recibido', MUESTREADO: 'Muestreado', ANALIZADO: 'Analizado', LIQUIDADO: 'Liquidado', ANULADO: 'Anulado' } as Record<string, string>)[e] ?? e;
  }

  boleta(): void {
    const l = this.lote();
    if (l) this.servicio.boleta(l.id).subscribe({ next: abrirPdf, error: () => this.toast.add({ severity: 'error', summary: 'No se pudo generar la boleta' }) });
  }

  rotulo(): void {
    const l = this.lote();
    if (l) this.servicio.rotulo(l.id).subscribe({ next: abrirPdf, error: () => this.toast.add({ severity: 'error', summary: 'No se pudo generar el rótulo' }) });
  }

  nuevoPesaje(): void {
    const bascula = this.pesaje.value.bascula;
    this.pesaje.reset({ tipo: 'INGRESO', bascula, peso_cliente_tipo: 'NETO' });
    this.tipoPesaje = 'INGRESO';
    this.cambiarTipo();
    this.pesajeVisible = true;
  }

  /** En un repesaje de control el chofer no es obligatorio (no hay bono). */
  cambiarTipo(): void {
    this.pesaje.patchValue({ tipo: this.tipoPesaje });
    const chofer = this.pesaje.get('chofer_nombre')!;
    this.tipoPesaje === 'CONTROL' ? chofer.clearValidators() : chofer.addValidators((c) => (c.value ? null : { required: true }));
    chofer.updateValueAndValidity();
  }

  guardarPesaje(): void {
    const l = this.lote();
    if (!l) return;
    this.guardando.set(true);
    const datos = this.pesaje.getRawValue() as DatosPesaje;
    this.servicio.agregarPesaje(l.id, datos).subscribe({
      next: (r) => {
        recordarBascula(datos.bascula);
        this.guardando.set(false);
        this.pesajeVisible = false;
        this.toast.add({ severity: 'success', summary: r.mensaje, life: 7000 });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se registró el pesaje', detail: mensajeDeError(e), life: 9000 });
      },
    });
  }

  netoCliente(p: Pesaje): number {
    return p.peso_cliente_tipo === 'BRUTO' ? +p.peso_cliente_kg! - +p.tara_kg : +p.peso_cliente_kg!;
  }

  historialCliente(p: Pesaje): string {
    return (p.correcciones_cliente ?? []).map((c) =>
      `${new Date(c.corregido_en).toLocaleDateString('es-BO')}: ${c.anterior_kg ?? '—'} ${c.anterior_tipo.toLowerCase()} → ${c.nuevo_kg ?? '—'} ${c.nuevo_tipo.toLowerCase()} · ${c.motivo}`).join('\n');
  }

  pedirCorreccion(p: Pesaje): void {
    this.aCorregir.set(p);
    this.correccion = { kg: p.peso_cliente_kg === null ? null : +p.peso_cliente_kg, tipo: p.peso_cliente_tipo ?? 'NETO', motivo: '' };
    this.correccionVisible = true;
  }

  corregir(): void {
    const p = this.aCorregir();
    if (!p) return;
    this.guardando.set(true);
    this.servicio.corregirPesoCliente(p.id, this.correccion.kg, this.correccion.tipo, this.correccion.motivo.trim()).subscribe({
      next: (r) => { this.guardando.set(false); this.correccionVisible = false; this.toast.add({ severity: 'success', summary: r.mensaje }); this.cargar(); },
      error: (e) => { this.guardando.set(false); this.toast.add({ severity: 'error', summary: 'No se corrigió', detail: mensajeDeError(e), life: 9000 }); },
    });
  }

  pedirAnulacion(p: Pesaje | null): void {
    this.aAnular.set(p);
    this.motivo = '';
    this.anularVisible = true;
  }

  anular(): void {
    const l = this.lote();
    const p = this.aAnular();
    if (!l) return;
    this.guardando.set(true);
    const pedido: Observable<{ mensaje: string }> = p ? this.servicio.anularPesaje(p.id, this.motivo.trim()) : this.servicio.anular(l.id, this.motivo.trim());
    pedido.subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.anularVisible = false;
        this.toast.add({ severity: 'success', summary: r.mensaje });
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se anuló', detail: mensajeDeError(e), life: 9000 });
      },
    });
  }
}
