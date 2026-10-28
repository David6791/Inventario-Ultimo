import { CommonModule } from '@angular/common';
import { Component, OnChanges, OnInit, ViewChild, inject, input, signal } from '@angular/core';
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
import { DatosPesaje, FotoRecepcion, LecturaTicket, Lote, Pesaje, PlantillaBascula } from '../core/models/cargas.model';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';
import { diferenciasBoleta } from '../core/diferencias';
import { RecepcionService } from '../core/services/recepcion.service';
import { PesajeCamposComponent, grupoPesaje, recordarBascula } from './pesaje-campos.component';
import { ConfirmarPesajeComponent, PesajeAConfirmar } from './confirmar-pesaje.component';
import { LoteLaboratorioComponent } from '../laboratorio/lote-laboratorio.component';
import { LoteValorComponent } from '../precios/lote-valor.component';

/** Ficha del lote: datos de recepción, pesajes con su bono, bitácora, boleta y anulación. */
@Component({
  selector: 'app-lote-ficha',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, ButtonModule, DialogModule, InputNumberModule, InputTextareaModule,
            SelectButtonModule, TableModule, ToastModule, TooltipModule, TienePermisoDirective, PesajeCamposComponent, ConfirmarPesajeComponent, LoteLaboratorioComponent, LoteValorComponent],
  providers: [MessageService],
  template: `
    <p-toast />
    <a routerLink="/cargas/lotes" class="volver"><i class="pi pi-arrow-left"></i> Lotes</a>

    <ng-container *ngIf="lote() as l">
      <header class="encabezado">
        <div>
          <h2><span class="codigo-lote">{{ l.codigo }}</span>
            <span class="pastilla estado" [ngClass]="'estado-' + l.estado.toLowerCase()">{{ etiquetaEstado(l.estado) }}</span>
            <span class="pastilla estado pastilla-acento" *ngIf="l.tipo_recepcion && l.tipo_recepcion !== 'BASCULA'">{{ etiquetaTipo(l) }}</span></h2>
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

      <div class="nota nota-par" *ngIf="l.lote_par as par">
        <i class="pi pi-clone"></i>
        <span>Recepción mixta: {{ esGranel(l) ? 'los sacos de este viaje están en el lote' : 'el granel de este viaje está en el lote' }}
          <a [routerLink]="['/cargas/lotes', par.id]" class="codigo">{{ par.codigo }}</a>{{ par.material ? ' (' + par.material + ')' : '' }}.</span>
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
        <div class="dato grande"><span class="rotulo">Peso que vale (húmedo)</span>
          <span class="monto">{{ kg(l.peso_neto_humedo_kg) }} kg</span>
          <small class="secundario">{{ l.num_pesajes }} pesaje(s){{ l.num_sacos ? ' · ' + l.num_sacos + ' sacos' : '' }}</small></div>
        <div class="dato grande" *ngIf="l.pesajes_con_peso_cliente"><span class="rotulo">Peso del cliente</span>
          <span class="monto">{{ kg(l.peso_cliente_kg) }} kg</span>
          <small [class.alerta]="alerta(l)" class="secundario">Diferencia {{ +l.diferencia_cliente_kg > 0 ? '+' : '' }}{{ kg(l.diferencia_cliente_kg) }} kg
            ({{ pct(l) }} %) · vale lo que dice «Peso que vale»</small></div>
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
              <span class="codigo" *ngIf="p.modalidad !== 'SACOS'">{{ p.ticket }}</span>
              <span *ngIf="p.modalidad === 'SACOS'">Balanza manual</span>
              <span class="pastilla" *ngIf="p.tipo === 'CONTROL'" pTooltip="Repesaje de control: no suma al peso del lote">Control</span>
              <div class="secundario">{{ p.bascula }} · {{ p.fecha | date: 'dd/MM HH:mm' }}</div>
              <div class="secundario" *ngIf="p.numero_orden">Orden <span class="codigo">{{ p.numero_orden }}</span></div>
              <div class="secundario" *ngIf="p.fecha_ticket">Boleta del {{ p.fecha_ticket | date: 'dd/MM/yyyy HH:mm' }}</div>
            </td>
            <td>
              {{ p.placa ?? 'Sin placa' }} · {{ p.chofer_nombre ?? '—' }}
              <div class="secundario" *ngIf="p.num_sacos">{{ p.num_sacos }} sacos</div>
              <div class="secundario" *ngIf="p.anulado">Anulado: {{ p.motivo_anulacion }}</div>
              <div class="secundario" *ngIf="p.viaje as v">Mismo camión que el ticket {{ v.ticket }}
                <ng-container *ngIf="v.lote">(<a [routerLink]="['/cargas/lotes', v.lote.id]">{{ v.lote.codigo }}</a>)</ng-container></div>
              <button type="button" class="enlace fotos" *ngIf="numFotos(p) as n" (click)="verFotos(p)">
                <i class="pi pi-images"></i> {{ n }} foto{{ n === 1 ? '' : 's' }}{{ p.sacos?.length ? ' · ' + p.sacos!.length + ' pesada' + (p.sacos!.length === 1 ? '' : 's') : '' }}</button>
            </td>
            <td class="derecha monto">{{ kg(p.peso_bruto_kg) }}</td>
            <td class="derecha monto">{{ p.modalidad === 'SACOS' ? '—' : kg(p.tara_kg) }}</td>
            <td class="derecha monto fuerte">{{ kg(p.peso_neto_kg) }}
              <div class="secundario" *ngIf="+(p.descuento_sacos_kg ?? 0) > 0">− {{ kg(p.descuento_sacos_kg) }} de sacos</div>
              <div class="vale" *ngIf="p.criterio_peso && p.criterio_peso !== 'EMPRESA'"
                   [pTooltip]="p.criterio_peso === 'CLIENTE' ? 'Nuestra báscula pesó igual o más: vale el del cliente' : 'Nuestra báscula pesó menos, dentro del límite: se promedian'">
                vale {{ kg(p.peso_final_kg) }} <span class="secundario">({{ p.criterio_peso === 'CLIENTE' ? 'cliente' : 'promedio' }})</span></div></td>
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
        <p-selectButton [options]="tipos" [allowEmpty]="false" [(ngModel)]="tipoPesaje" optionLabel="etiqueta" optionValue="valor" (onChange)="cambiarTipo()" />
        <small class="secundario">{{ tipoPesaje === 'INGRESO' ? 'Otro camión del mismo lote: suma al peso y genera su bono.' :
          'Repesaje para verificar: no suma al peso ni genera bono.' }}</small>
      </div>
      <app-pesaje-campos *ngIf="pesajeVisible" [grupo]="pesaje" [plantillas]="plantillas()" [fotoObligatoria]="fotoObligatoria()" [limite]="limite()"
                         [claudeDisponible]="claude()" (leido)="lecturas = $event" />
      <div class="nota-diferencias" *ngIf="diferencias().length">
        <b>Lo leído de la boleta no coincide con lo anotado:</b>
        <ul><li *ngFor="let d of diferencias()">{{ d }}</li></ul>
        <span>Corrija lo que haga falta, o pulse otra vez «Registrar pesaje» para guardar igual.</span>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="pesajeVisible = false" />
        <p-button label="Registrar pesaje" icon="pi pi-check" [loading]="guardando()" [disabled]="pesaje.invalid || guardando()"
                  (onClick)="guardarPesaje()" />
      </ng-template>
    </p-dialog>

    <app-confirmar-pesaje [(visible)]="confirmarVisible" [datos]="aConfirmar()" [vale]="valeAConfirmar()" [extras]="extrasConfirmar()"
                          (confirmado)="guardarPesaje(true)" />

    <!-- Fotos de un pesaje -->
    <p-dialog [(visible)]="fotosVisible" [header]="'Fotos del pesaje ' + (fotosDe()?.ticket ?? '')" [modal]="true"
              [style]="{ width: '56rem', maxWidth: '96vw' }" [draggable]="false" (onHide)="soltarFotos()">
      <div class="galeria">
        <figure *ngFor="let f of galeria()">
          <a *ngIf="f.url" [href]="f.url" target="_blank" rel="noopener"><img [src]="f.url" [alt]="f.titulo" /></a>
          <div *ngIf="!f.url" class="cargando"><i class="pi pi-spin pi-spinner"></i></div>
          <figcaption>{{ f.titulo }}
            <button *ngIf="f.ticket" type="button" class="enlace" (click)="verOriginal(f.id)">· foto original</button></figcaption>
        </figure>
      </div>
    </p-dialog>

    <!-- Anular -->
    <!-- Corregir peso del cliente -->
    <p-dialog [(visible)]="correccionVisible" [header]="'Peso del cliente · ticket ' + (aCorregir()?.ticket ?? '')" [modal]="true"
              [style]="{ width: '32rem' }" [draggable]="false">
      <p class="explicacion">No cambia el bono. Sí recalcula el peso que vale del pesaje con la regla de la empresa (menor, promedio o el nuestro). La corrección queda registrada con su motivo.
        Báscula de la empresa: bruto {{ kg(aCorregir()?.peso_bruto_kg) }}, tara {{ kg(aCorregir()?.tara_kg) }}, neto {{ kg(aCorregir()?.peso_neto_kg) }}.</p>
      <div class="campo">
        <label>Peso que declaró el cliente (kg) <span class="secundario">vacío si no declaró</span></label>
        <p-inputNumber [(ngModel)]="correccion.kg" mode="decimal" locale="es-BO" [maxFractionDigits]="2" [min]="0" />
        <p-selectButton [options]="tiposCliente" [allowEmpty]="false" [(ngModel)]="correccion.tipo" optionLabel="etiqueta" optionValue="valor" />
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
    td .vale { font-size: 0.8rem; color: #4338ca; font-weight: 600; }
    .nota-diferencias { margin-top: 0.8rem; padding: 0.6rem 0.8rem; border-radius: 8px; background: #fef3c7; color: #92400e; font-size: 0.86rem; }
    .nota-diferencias ul { margin: 0.3rem 0; padding-left: 1.1rem; }
    .nota-par { display: flex; gap: 0.5rem; align-items: center; padding: 0.55rem 0.8rem; border-radius: 8px; background: #eff6ff;
                color: #1e3a8a; margin-bottom: 1rem; font-size: 0.88rem; }
    .enlace.fotos { display: inline-flex; gap: 0.3rem; align-items: center; margin-top: 0.2rem; font-size: 0.8rem; }
    .galeria { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 0.8rem; }
    .galeria figure { margin: 0; display: flex; flex-direction: column; gap: 0.3rem; }
    .galeria img { width: 100%; max-height: 20rem; object-fit: contain; border-radius: 6px; border: 1px solid var(--surface-border, #e5e7eb); background: #f8fafc; }
    .galeria .cargando { height: 10rem; display: grid; place-items: center; background: #f8fafc; border-radius: 6px; }
    .galeria figcaption { font-size: 0.8rem; color: var(--text-color-secondary, #6b7280); }
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
export class LoteFichaComponent implements OnInit, OnChanges {
  readonly id = input.required<string>();

  private readonly servicio = inject(RecepcionService);
  private readonly toast = inject(MessageService);
  private readonly fb = inject(FormBuilder);
  private readonly catalogos = inject(CatalogosCargasService);

  readonly plantillas = signal<PlantillaBascula[]>([]);
  readonly fotoObligatoria = signal(false);
  readonly limite = signal(100);
  readonly claude = signal(false);
  confirmarVisible = false;
  @ViewChild(PesajeCamposComponent) private camposPesaje?: PesajeCamposComponent;
  readonly aConfirmar = signal<PesajeAConfirmar | null>(null);
  readonly valeAConfirmar = signal<{ kg: number; criterio: 'EMPRESA' | 'CLIENTE' | 'PROMEDIO' } | null>(null);
  readonly extrasConfirmar = signal<{ etiqueta: string; valor: string | null | undefined }[]>([]);
  readonly fotosDe = signal<Pesaje | null>(null);
  lecturas: { interior: LecturaTicket | null; exterior: LecturaTicket | null } = { interior: null, exterior: null };
  readonly diferencias = signal<string[]>([]);
  readonly galeria = signal<{ id: number; titulo: string; ticket: boolean; url: string | null }[]>([]);
  fotosVisible = false;

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
    this.servicio.plantillas(true).subscribe((r) => this.plantillas.set(r.data));
    this.catalogos.opciones$.subscribe((o) => {
      this.fotoObligatoria.set(!!o.foto_ticket_obligatoria);
      this.limite.set(o.limite_promedio_peso_kg ?? 100);
      this.claude.set(!!o.lector_claude);
    });
  }

  /** También al pasar de un lote a su par: la ruta es la misma y solo cambia el id. */
  ngOnChanges(): void { this.cargar(); }

  etiquetaTipo(l: Lote): string {
    if (l.tipo_recepcion === 'SACOS') return 'Solo sacos';
    return this.esGranel(l) ? 'Mixta · granel' : 'Mixta · sacos';
  }

  /** En la mixta, el lote de granel es el que tiene el pesaje de báscula. */
  esGranel(l: Lote): boolean {
    return (l.pesajes ?? []).some((p) => p.modalidad !== 'SACOS');
  }

  numFotos(p: Pesaje): number {
    return (p.fotos?.length ?? 0) + (p.sacos ?? []).reduce((n, s) => n + (s.fotos?.length ?? 0), 0);
  }

  verFotos(p: Pesaje): void {
    const lista: { id: number; titulo: string; ticket: boolean }[] = [
      ...(p.fotos ?? []).map((f: FotoRecepcion) => ({ id: f.id, ticket: true, titulo: f.tipo === 'TICKET_EXTERIOR' ? 'Ticket exterior (cliente)' : 'Ticket interior (empresa)' })),
      ...(p.sacos ?? []).flatMap((s) => (s.fotos ?? []).map((f) => ({
        id: f.id, ticket: false, titulo: `Pesada ${s.orden}: ${s.sacos} saco${s.sacos === 1 ? '' : 's'}, ${formatoDinero(s.peso_kg)} kg` }))),
    ];
    this.fotosDe.set(p);
    this.galeria.set(lista.map((f) => ({ ...f, url: null })));
    this.fotosVisible = true;
    for (const f of lista) {
      this.servicio.foto(f.id).subscribe((b) => {
        const url = URL.createObjectURL(b);
        this.galeria.update((g) => g.map((x) => (x.id === f.id ? { ...x, url } : x)));
      });
    }
  }

  /** La foto tal como salió de la cámara, antes de enderezarla. */
  verOriginal(id: number): void {
    this.servicio.foto(id, true).subscribe((b) => window.open(URL.createObjectURL(b), '_blank'));
  }

  soltarFotos(): void {
    for (const f of this.galeria()) if (f.url) URL.revokeObjectURL(f.url);
    this.galeria.set([]);
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
    this.lecturas = { interior: null, exterior: null };
    this.diferencias.set([]);
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

  guardarPesaje(confirmado = false): void {
    const l = this.lote();
    if (!l) return;
    const p = this.pesaje.getRawValue();
    if (!confirmado && this.camposPesaje?.modo() === 'MANUAL') {
      this.aConfirmar.set(p as PesajeAConfirmar);
      this.valeAConfirmar.set(this.tipoPesaje === 'INGRESO' ? this.camposPesaje.vale() : null);
      this.extrasConfirmar.set([
        { etiqueta: 'Lote', valor: l.codigo },
        { etiqueta: 'Tipo de pesaje', valor: this.tipos.find((t) => t.valor === this.tipoPesaje)?.etiqueta },
      ]);
      this.confirmarVisible = true;
      return;
    }
    const d = confirmado ? [] : diferenciasBoleta(this.lecturas.interior, this.lecturas.exterior,
      { placa: p.placa, chofer_nombre: p.chofer_nombre }, l.productor?.nombre ?? null);
    if (d.length && d.join('|') !== this.diferencias().join('|')) {
      this.diferencias.set(d);           // segunda vez con las mismas diferencias: se guarda igual
      return;
    }
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
