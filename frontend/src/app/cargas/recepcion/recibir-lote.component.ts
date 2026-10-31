import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { diferenciasBoleta } from '../core/diferencias';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { formatoDinero } from '../../caja/core/dinero';
import { Bocamina, DatosRecepcion, PesoQueVale, LecturaTicket, Mina, Opciones, PlantillaBascula, Productor, ProductorParecido, SerieLote, TipoRecepcion } from '../core/models/cargas.model';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';
import { RecepcionService } from '../core/services/recepcion.service';
import { SeriesService } from '../core/services/series.service';
import { PesajeCamposComponent, datosPesaje, grupoPesaje, recordarBascula } from './pesaje-campos.component';
import { SacosCamposComponent, datosSacos, grupoSacos } from './sacos-campos.component';
import { ConfirmarPesajeComponent, PesajeAConfirmar } from './confirmar-pesaje.component';

const CLAVE_TIPO = 'cargas.tipo-recepcion';

/**
 * Recepción de un lote. La serie decide el origen: de compra pide productor;
 * de producción propia, mina propia y bocamina. El código lo genera la base al
 * guardar (se muestra el próximo que saldrá). El primer pesaje va en el mismo
 * paso si el camión ya pasó por la báscula.
 */
@Component({
  selector: 'app-recibir-lote',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, AutoCompleteModule, ButtonModule, CheckboxModule,
            DropdownModule, InputTextModule, InputTextareaModule, SelectButtonModule, ToastModule, DialogModule, PesajeCamposComponent,
            SacosCamposComponent, ConfirmarPesajeComponent],
  providers: [MessageService],
  template: `
    <p-toast />
    <a routerLink="/cargas/lotes" class="volver"><i class="pi pi-arrow-left"></i> Lotes</a>

    <header class="encabezado">
      <div>
        <h2>Recibir lote</h2>
        <p class="subtitulo">Registre el mineral que llega. El código del lote sale solo; la cooperativa y el
          municipio se toman del productor y de la mina.</p>
      </div>
    </header>

    <form [formGroup]="form" class="tarjeta">
      <h3>Lote</h3>
      <div class="campos">
        <div class="campo span-3">
          <label for="serie">Serie</label>
          <p-dropdown inputId="serie" formControlName="serie_id" [options]="series()" optionLabel="nombre" optionValue="id"
                      placeholder="Elija la serie" [filter]="true" filterBy="nombre,prefijo" appendTo="body" [style]="{ width: '100%' }">
            <ng-template let-s pTemplate="item">
              <div class="opcion-serie"><span class="codigo">{{ s.prefijo }}</span> {{ s.nombre }}
                <span class="pastilla" [class.pastilla-acento]="s.origen === 'PROPIA'">{{ s.origen === 'PROPIA' ? 'Propia' : 'Compra' }}</span></div>
            </ng-template>
          </p-dropdown>
        </div>
        <div class="campo span-3">
          <label>Código que se asignará</label>
          <div class="proximo">{{ serie()?.proximo_codigo ?? '—' }}</div>
          <small *ngIf="serie()">{{ serie()!.linea?.nombre }}</small>
        </div>
      </div>
    </form>

    <!-- Productor y mina (compra) o mina propia y bocamina: van dentro del pesaje, como en la boleta -->
    <ng-template #origen>
      <div [formGroup]="form" class="campos origen" *ngIf="serie()">
        <ng-container *ngIf="serie()?.origen === 'COMPRA'">
          <div class="campo span-3">
            <label for="productor">Productor</label>
            <p-autoComplete inputId="productor" [(ngModel)]="productorTexto" [ngModelOptions]="{ standalone: true }"
                            [suggestions]="productores()" (completeMethod)="buscarProductor($event.query)" (onSelect)="elegirProductor($event.value)"
                            (onClear)="elegirProductor(null)" field="nombre" [minLength]="2" [delay]="250" [forceSelection]="true"
                            placeholder="Nombre, CI o NIT" appendTo="body" [style]="{ width: '100%' }" [inputStyle]="{ width: '100%' }">
              <ng-template let-p pTemplate="item">
                <div class="sugerencia"><span>{{ p.nombre }}</span>
                  <span class="secundario">{{ p.ci ? 'CI ' + p.ci : p.nit ? 'NIT ' + p.nit : '' }} {{ p.cooperativa?.nombre ? '· ' + p.cooperativa.nombre : '' }}</span></div>
              </ng-template>
            </p-autoComplete>
            <small *ngIf="productor() as p">{{ p.cooperativa?.nombre ?? 'Sin cooperativa' }}
              <span class="de-boleta" *ngIf="productorDeBoleta()"><i class="pi pi-camera"></i> elegido por la boleta</span></small>
            <div class="parecidos" *ngIf="!productor() && parecidos().length">
              <small>En la boleta: <b>{{ nombreLeido() }}</b>. ¿Es alguno de estos?</small>
              <button type="button" class="parecido" *ngFor="let x of parecidos()" (click)="usarParecido(x)">
                {{ x.nombre }} <span class="secundario">{{ x.ci ? 'CI ' + x.ci : '' }} · {{ x.parecido * 100 | number: '1.0-0' }} %</span></button>
            </div>
            <small class="aviso-texto" *ngIf="!productor() && nombreLeido() && !parecidos().length && buscado()">
              «{{ nombreLeido() }}» no está en el catálogo de productores: búsquelo o regístrelo.</small>
          </div>
          <div class="campo span-3">
            <label for="mina">Mina <span class="opcional">(opcional)</span></label>
            <p-dropdown inputId="mina" formControlName="mina_id" [options]="minasCompra()" optionLabel="nombre" optionValue="id"
                        placeholder="De dónde viene el mineral" [filter]="true" filterBy="nombre" [showClear]="true" appendTo="body" [style]="{ width: '100%' }" />
            <small>Define el municipio para la regalía.</small>
          </div>
        </ng-container>
        <ng-container *ngIf="serie()?.origen === 'PROPIA'">
          <div class="campo span-3">
            <label for="mina-propia">Mina propia</label>
            <p-dropdown inputId="mina-propia" formControlName="mina_id" [options]="minasPropias()" optionLabel="nombre" optionValue="id"
                        placeholder="Elija la mina" appendTo="body" (onChange)="cargarBocaminas()" [style]="{ width: '100%' }" />
          </div>
          <div class="campo span-3">
            <label for="bocamina">Bocamina</label>
            <p-dropdown inputId="bocamina" formControlName="bocamina_id" [options]="bocaminas()" optionValue="id"
                        [optionLabel]="'codigo'" placeholder="Elija la bocamina" appendTo="body" [style]="{ width: '100%' }" />
          </div>
        </ng-container>
      </div>
      <p class="secundario" *ngIf="!serie()">Elija la serie para anotar el productor y la mina.</p>
    </ng-template>

    <section class="tarjeta tipo">
      <h3>Tipo de recepción</h3>
      <p-selectButton [options]="tipos" [allowEmpty]="false" [(ngModel)]="tipoRecepcion" (onChange)="cambiarTipo()" optionLabel="etiqueta" optionValue="valor"
                      [ngModelOptions]="{ standalone: true }" styleClass="tipos">
        <ng-template let-t pTemplate="item"><i [class]="t.icono"></i><span>{{ t.etiqueta }}</span></ng-template>
      </p-selectButton>
      <p class="secundario explicacion">{{ explicacion() }}</p>
    </section>

    <section class="tarjeta" *ngIf="tipoRecepcion !== 'SACOS'">
      <div class="titulo-pesaje">
        <h3>{{ tipoRecepcion === 'MIXTA' ? 'Pesaje del camión en báscula' : 'Pesaje de ingreso' }}</h3>
        <span class="check" *ngIf="tipoRecepcion === 'BASCULA'"><p-checkbox [(ngModel)]="conPesaje" [binary]="true" inputId="con-pesaje" />
          <label for="con-pesaje">El camión ya pasó por la báscula</label></span>
      </div>
      <app-pesaje-campos *ngIf="conPesaje || tipoRecepcion === 'MIXTA'; else soloOrigen" [grupo]="pesaje" [plantillas]="plantillas()"
                         [fotoObligatoria]="!!opciones()?.foto_ticket_obligatoria" [sinSacos]="tipoRecepcion === 'MIXTA'"
                         [descuentoSacos]="tipoRecepcion === 'MIXTA' ? (reparto()?.sacos ?? 0) : 0"
                         [claudeDisponible]="!!opciones()?.lector_claude" (leido)="boletasLeidas($event)">
        <ng-container *ngTemplateOutlet="origen" />
      </app-pesaje-campos>
      <ng-template #soloOrigen>
        <ng-container *ngTemplateOutlet="origen" />
        <p class="secundario">Podrá agregar los pesajes después, desde la ficha del lote.</p>
      </ng-template>
    </section>

    <section class="tarjeta" *ngIf="tipoRecepcion !== 'BASCULA'">
      <h3>{{ tipoRecepcion === 'MIXTA' ? 'Sacos (van en otro lote)' : 'Sacos en balanza manual' }}</h3>
      <ng-container *ngIf="tipoRecepcion === 'SACOS'"><ng-container *ngTemplateOutlet="origen" /></ng-container>
      <app-sacos-campos [grupo]="sacos" [conTransporte]="tipoRecepcion === 'SACOS'" />

      <ng-container *ngIf="tipoRecepcion === 'MIXTA'">
        <div class="reparto" *ngIf="reparto() as r" [class.error]="r.granel <= 0">
          <div><span>Neto del ticket</span><strong class="codigo">{{ fmt(r.neto) }} kg</strong></div>
          <div><span>− Sacos</span><strong class="codigo">{{ fmt(r.sacos) }} kg</strong></div>
          <div class="igual"><span>= Granel (este lote)</span><strong class="codigo">{{ fmt(r.granel) }} kg</strong></div>
        </div>
        <div class="campos lote-sacos">
          <div class="campo span-2">
            <label for="material-sacos">Material de los sacos <span class="opcional">(opcional)</span></label>
            <p-dropdown inputId="material-sacos" [(ngModel)]="materialSacos" [ngModelOptions]="{ standalone: true }"
                        [options]="opciones()?.materiales ?? []" optionLabel="etiqueta" optionValue="valor"
                        placeholder="Elementos que trae" [showClear]="true" appendTo="body" [style]="{ width: '100%' }" />
          </div>
          <div class="campo span-4">
            <label for="obs-sacos">Observaciones del lote de sacos <span class="opcional">(opcional)</span></label>
            <input id="obs-sacos" pInputText [(ngModel)]="observacionesSacos" [ngModelOptions]="{ standalone: true }" maxlength="1000" />
          </div>
        </div>
        <p class="secundario">Se crean dos lotes de la misma serie y productor: el de granel con el neto del ticket menos los sacos,
          y el de sacos con sus pesadas. El bono de transporte es uno solo, por el camión completo; el de laboratorio, uno por lote.</p>
      </ng-container>
    </section>

    <!-- Más datos del lote -->
    <form [formGroup]="form" class="tarjeta">
      <h3>Más datos</h3>
      <div class="campos">
        <div class="campo span-3" *ngIf="!sedeFija(); else sedeAsignada">
          <label for="sede">Acopio</label>
          <p-dropdown inputId="sede" formControlName="almacen_id" [options]="sedes()" optionLabel="nombre"
                      optionValue="id" placeholder="Elija el acopio" appendTo="body" [style]="{ width: '100%' }" />
          <small class="aviso-texto" *ngIf="opciones() && !sedes().length">Su usuario no recibe carga en ningún acopio: pida que lo asignen en «Acopios y recepcionistas».</small>
        </div>
        <ng-template #sedeAsignada>
          <div class="campo span-3">
            <label>Acopio</label>
            <div class="sede-fija"><i class="pi pi-map-marker"></i> {{ sedeFija()!.nombre }}</div>
            <small>Es el acopio donde usted recibe carga.</small>
          </div>
        </ng-template>
        <div class="campo span-3">
          <label for="guia">Guía de transporte <span class="opcional">(opcional)</span></label>
          <input id="guia" pInputText formControlName="guia_transporte" maxlength="40" class="codigo" />
        </div>
        <div class="campo span-2">
          <label for="material">Material</label>
          <p-dropdown inputId="material" formControlName="material" [options]="opciones()?.materiales ?? []" optionLabel="etiqueta"
                      optionValue="valor" placeholder="Elementos que trae" [showClear]="true" appendTo="body" [style]="{ width: '100%' }" />
          <small *ngIf="bonoLab() as b" class="bono-lab"><i class="pi pi-filter-fill"></i>
            Bono de laboratorio: <b>{{ b.moneda === 'USD' ? 'US$' : 'Bs' }} {{ fmt(b.monto) }}</b> ({{ b.num_elementos }} elemento{{ b.num_elementos === 1 ? '' : 's' }})</small>
          <small *ngIf="!form.value.material && serie()?.origen === 'COMPRA'" class="secundario">Sin material no se genera el bono de laboratorio.</small>
        </div>
        <div class="campo span-4">
          <label for="obs">Observaciones <span class="opcional">(opcional)</span></label>
          <textarea id="obs" pInputTextarea formControlName="observaciones" rows="2" maxlength="1000"></textarea>
        </div>
      </div>
    </form>

    <app-confirmar-pesaje [(visible)]="confirmarVisible" [datos]="aConfirmar()" [vale]="valeAConfirmar()" [extras]="extrasConfirmar()"
                          [diferencias]="diferencias()" (confirmado)="guardar(true)" />

    <div class="faltan" *ngIf="faltanVisibles().length" role="alert">
      <b><i class="pi pi-exclamation-circle"></i> Para recibir el lote falta:</b>
      <ul>
        <li *ngFor="let f of faltanVisibles()"><button type="button" class="enlace" (click)="irA(f.id)">{{ f.texto }}</button></li>
      </ul>
    </div>

    <div class="pie">
      <p-button label="Cancelar" [text]="true" routerLink="/cargas/lotes" />
      <p-button label="Recibir lote" icon="pi pi-check" [loading]="guardando()" [disabled]="guardando()" (onClick)="guardar()" />
    </div>
  `,
  styles: [ESTILOS_CARGAS, `
    .volver { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; margin-bottom: 0.6rem;
              color: var(--text-color-secondary, #6b7280); text-decoration: none; }
    .tarjeta { border: 1px solid var(--surface-border, #e5e7eb); border-radius: 10px; padding: 1rem 1.2rem;
               background: var(--surface-card, #fff); margin-bottom: 1rem; max-width: 60rem; }
    .tarjeta h3 { margin: 0 0 0.8rem; font-size: 1rem; }
    .proximo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 1.3rem; font-weight: 700; padding: 0.3rem 0; }
    .opcional { font-weight: 400; color: var(--text-color-secondary, #9ca3af); }
    .titulo-pesaje { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; }
    .titulo-pesaje h3 { margin: 0; }
    .check { display: flex; align-items: center; gap: 0.4rem; font-size: 0.88rem; }
    .pie { display: flex; justify-content: flex-end; gap: 0.5rem; max-width: 60rem; }
    .sugerencia { display: flex; flex-direction: column; }
    .opcion-serie { display: flex; gap: 0.5rem; align-items: center; }
    :host ::ng-deep .tipos .p-button { gap: 0.45rem; }
    .explicacion { margin: 0.6rem 0 0; font-size: 0.85rem; }
    .reparto { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin: 1rem 0 0.8rem; padding: 0.7rem 0.9rem;
               border-radius: 8px; background: #eff6ff; border: 1px solid #bfdbfe; }
    .reparto div { display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.8rem; color: var(--text-color-secondary, #475569); }
    .reparto strong { font-size: 1.05rem; color: var(--text-color, #0f172a); }
    .reparto .igual strong { color: #1d4ed8; }
    .reparto.error { background: #fef2f2; border-color: #fecaca; }
    .reparto.error .igual strong { color: #b91c1c; }
    @media (max-width: 560px) { .reparto { grid-template-columns: 1fr; } }
    .lote-sacos { margin-bottom: 0.6rem; }
    .parecidos { display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.3rem; }
    .parecido { text-align: left; border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 6px; padding: 0.35rem 0.6rem;
                cursor: pointer; font-size: 0.85rem; }
    .parecido:hover { background: #dbeafe; }
    .de-boleta { color: #047857; margin-left: 0.4rem; }
    .sede-fija { display: flex; gap: 0.4rem; align-items: center; font-weight: 600; padding: 0.55rem 0; }
    .aviso-texto { color: #b45309; }
    .origen { margin: 0.2rem 0 0.3rem; }
    .faltan { max-width: 60rem; margin-bottom: 0.8rem; padding: 0.7rem 1rem; border-radius: 8px; background: #fef2f2;
              border: 1px solid #fecaca; color: #991b1b; font-size: 0.9rem; }
    .faltan ul { margin: 0.35rem 0 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.2rem; }
    .faltan .enlace { border: 0; background: none; color: #991b1b; text-decoration: underline; cursor: pointer; padding: 0; font: inherit; text-align: left; }
    :host ::ng-deep .resaltado, :host ::ng-deep .resaltado input { outline: 2px solid #ef4444; outline-offset: 2px; border-radius: 6px; }
    .bono-lab { color: #6d28d9; display: flex; gap: 0.3rem; align-items: center; }
  `],
})
export class RecibirLoteComponent implements OnInit {
  private readonly catalogos = inject(CatalogosCargasService);
  private readonly seriesSrv = inject(SeriesService);
  private readonly servicio = inject(RecepcionService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(MessageService);
  private readonly router = inject(Router);

  readonly series = signal<SerieLote[]>([]);
  readonly minas = signal<Mina[]>([]);
  readonly bocaminas = signal<Bocamina[]>([]);
  readonly productores = signal<Productor[]>([]);
  readonly productor = signal<Productor | null>(null);
  readonly opciones = signal<Opciones | null>(null);
  readonly serieId = signal<number | null>(null);
  readonly guardando = signal(false);

  productorTexto: string | Productor | null = null;
  conPesaje = true;
  tipoRecepcion: TipoRecepcion = RecibirLoteComponent.tipoGuardado();
  materialSacos: string | null = null;
  observacionesSacos: string | null = null;
  readonly plantillas = signal<PlantillaBascula[]>([]);
  private lecturas: { interior: LecturaTicket | null; exterior: LecturaTicket | null } = { interior: null, exterior: null };
  readonly nombreLeido = signal<string | null>(null);
  readonly parecidos = signal<ProductorParecido[]>([]);
  readonly buscado = signal(false);
  readonly productorDeBoleta = signal(false);
  readonly diferencias = signal<string[]>([]);
  confirmarVisible = false;
  @ViewChild(PesajeCamposComponent) private camposPesaje?: PesajeCamposComponent;
  readonly aConfirmar = signal<PesajeAConfirmar | null>(null);
  readonly valeAConfirmar = signal<PesoQueVale | null>(null);
  readonly bonoLab = signal<{ num_elementos: number; monto: string; moneda: string } | null>(null);
  readonly extrasConfirmar = signal<{ etiqueta: string; valor: string | null | undefined }[]>([]);
  readonly tipos = [
    { valor: 'BASCULA', etiqueta: 'Báscula', icono: 'pi pi-truck' },
    { valor: 'SACOS', etiqueta: 'Solo sacos', icono: 'pi pi-box' },
    { valor: 'MIXTA', etiqueta: 'Mixta (granel + sacos)', icono: 'pi pi-clone' },
  ];
  readonly fmt = formatoDinero;
  private readonly tipoActual = signal<TipoRecepcion>(this.tipoRecepcion);
  readonly explicacion = computed(() => ({
    BASCULA: 'El camión se pesa en la báscula. Tome la foto del ticket interior (y del exterior, si el cliente trae el suyo): los datos se leen solos.',
    SACOS: 'Los sacos se pesan en la balanza manual: un total o pesada por pesada, cada una con la foto del momento del pesaje.',
    MIXTA: 'La volqueta trae mineral a granel y sacos: se pesa el camión en báscula y los sacos en la balanza manual. Salen dos lotes.',
  })[this.tipoActual()]);
  readonly sacos = grupoSacos(this.fb);
  private readonly valoresMixta = signal(0);

  readonly form = this.fb.group({
    serie_id: [null as number | null, Validators.required],
    almacen_id: [null as number | null, Validators.required],
    mina_id: [null as number | null],
    bocamina_id: [null as number | null],
    guia_transporte: [null as string | null],
    material: [null as string | null],
    observaciones: [null as string | null],
  });
  readonly pesaje = grupoPesaje(this.fb);

  readonly reparto = computed(() => {
    this.valoresMixta();
    const p = this.pesaje.getRawValue();
    const neto = (p.peso_bruto_kg ?? 0) - (p.tara_kg ?? 0);
    const sacos = (this.sacos.getRawValue().pesadas as { peso_kg: number | null }[]).reduce((t, x) => t + (x.peso_kg ?? 0), 0);
    if (!p.peso_bruto_kg || p.tara_kg == null) return null;
    return { neto, sacos, granel: Math.round((neto - sacos) * 100) / 100 };
  });

  private static tipoGuardado(): TipoRecepcion {
    try { return (localStorage.getItem(CLAVE_TIPO) as TipoRecepcion) || 'BASCULA'; } catch { return 'BASCULA'; }
  }

  cambiarTipo(): void {
    this.tipoActual.set(this.tipoRecepcion);
    try { localStorage.setItem(CLAVE_TIPO, this.tipoRecepcion); } catch { /* sin almacenamiento */ }
  }

  /** Sedes donde este usuario recibe; con una sola asignada, va fija y no se elige. */
  /** Acopios donde recibe: con el nombre del centro de costo (el almacén, si todavía no tiene centro). */
  readonly sedes = computed(() => (this.opciones()?.sedes_recepcion ?? this.opciones()?.almacenes ?? [])
    .map((s) => ({ ...s, nombre: (s as { centro_costo?: { nombre: string } | null }).centro_costo?.nombre ?? s.nombre })));
  readonly sedeFija = computed(() => {
    const id = this.opciones()?.sede_recepcion_fija;
    return id ? this.sedes().find((s) => s.id === id) ?? null : null;
  });

  readonly serie = computed(() => this.series().find((s) => s.id === this.serieId()) ?? null);
  readonly minasCompra = computed(() => this.minas().filter((m) => !m.propia));
  readonly minasPropias = computed(() => this.minas().filter((m) => m.propia));

  ngOnInit(): void {
    this.servicio.plantillas(true).subscribe((r) => this.plantillas.set(r.data));
    this.pesaje.valueChanges.subscribe(() => this.valoresMixta.update((n) => n + 1));
    // Con los avisos a la vista, se van quitando a medida que se completa.
    for (const g of [this.form, this.pesaje, this.sacos]) {
      g.valueChanges.subscribe(() => { if (this.faltanVisibles().length) this.faltanVisibles.set(this.faltantes()); });
    }
    this.sacos.valueChanges.subscribe(() => this.valoresMixta.update((n) => n + 1));
    this.seriesSrv.listar().subscribe((r) => this.series.set(r.data.filter((s) => s.activa)));
    this.catalogos.listarMinas({ solo_activas: true }).subscribe((m) => this.minas.set(m));
    this.catalogos.opciones$.subscribe((o) => {
      this.opciones.set(o);
      const lista = o.sedes_recepcion ?? o.almacenes;
      const pred = o.almacen_predeterminado && lista.some((a) => a.id === o.almacen_predeterminado) ? o.almacen_predeterminado : null;
      const sede = o.sede_recepcion_fija ?? pred ?? (lista.length === 1 ? lista[0].id : null);
      if (sede && !this.form.value.almacen_id) this.form.patchValue({ almacen_id: sede });
    });
    this.form.get('material')!.valueChanges.pipe(
      switchMap((m) => (m ? this.servicio.bonoLaboratorioPara(m).pipe(catchError(() => of(null))) : of(null))),
    ).subscribe((b) => this.bonoLab.set(b));
    this.form.get('serie_id')!.valueChanges.subscribe((id) => {
      this.serieId.set(id);
      this.form.patchValue({ mina_id: null, bocamina_id: null }, { emitEvent: false });
      this.bocaminas.set([]);
    });
  }

  buscarProductor(texto: string): void {
    this.catalogos.listarProductores({ buscar: texto }).subscribe((r) => this.productores.set(r.data.filter((p) => p.activo)));
  }

  elegirProductor(p: Productor | null): void {
    this.productor.set(p);
    if (this.faltanVisibles().length) setTimeout(() => this.faltanVisibles.set(this.faltantes()));
    this.productorDeBoleta.set(false);
  }

  cargarBocaminas(): void {
    const mina = this.form.value.mina_id;
    this.form.patchValue({ bocamina_id: null });
    if (mina) this.catalogos.listarBocaminas(mina).subscribe((b) => this.bocaminas.set(b.filter((x) => x.activa)));
  }

  /** Lo que falta para recibir el lote, con el campo al que lleva cada aviso. */
  faltantes(): { texto: string; id: string }[] {
    const f: { texto: string; id: string }[] = [];
    const s = this.serie();
    const v = this.form.getRawValue();
    if (!s) f.push({ texto: 'Elija la serie del lote.', id: 'serie' });
    if (!v.almacen_id) f.push({ texto: 'Elija el acopio donde recibe.', id: 'sede' });
    if (s?.origen === 'COMPRA' && !this.productor()) {
      f.push({ texto: this.productorTexto ? 'Elija el productor de la lista (escribir el nombre no basta: búsquelo y tóquelo).'
                                          : 'Indique el productor.', id: 'productor' });
    }
    if (s?.origen === 'PROPIA') {
      if (!v.mina_id) f.push({ texto: 'Elija la mina propia.', id: 'mina-propia' });
      if (!v.bocamina_id) f.push({ texto: 'Elija la bocamina.', id: 'bocamina' });
    }
    const t = this.tipoRecepcion;
    if (t === 'MIXTA' || (t === 'BASCULA' && this.conPesaje)) {
      const p = this.pesaje.getRawValue();
      const control = (c: string) => this.pesaje.get(c)!;
      if (control('foto_interior_id').invalid) f.push({ texto: 'Suba la foto (o el escaneo) de la boleta interior: es obligatoria.', id: 'pesaje' });
      if (!p.peso_bruto_kg) f.push({ texto: 'Anote el peso bruto de nuestra báscula.', id: 'bruto' });
      if (p.tara_kg == null) f.push({ texto: 'Anote la tara de nuestra báscula.', id: 'tara' });
      if (p.peso_bruto_kg && p.tara_kg != null && p.tara_kg >= p.peso_bruto_kg) f.push({ texto: 'La tara debe ser menor que el peso bruto.', id: 'tara' });
      if (p.peso_cliente_bruto_kg != null && p.peso_cliente_tara_kg != null && p.peso_cliente_tara_kg >= p.peso_cliente_bruto_kg) {
        f.push({ texto: 'En la boleta del cliente, la tara debe ser menor que el bruto.', id: 'c-tara' });
      }
      if (control('chofer_nombre').invalid) f.push({ texto: 'Anote el chofer (cobra el bono de transporte).', id: 'chofer' });
      if (!String(p.bascula ?? '').trim()) f.push({ texto: 'Anote la báscula (en «Más datos de la boleta»).', id: 'bascula' });
      if (!String(p.ticket ?? '').trim()) f.push({ texto: 'Anote el n.º de ticket (en «Más datos de la boleta»).', id: 'ticket' });
      if (control('numero_orden').invalid) f.push({ texto: 'El n.º de orden es demasiado largo.', id: 'orden' });
    }
    if (t !== 'BASCULA') {
      const g = this.sacos.getRawValue() as { bascula: string; pesadas: { sacos: number | null; peso_kg: number | null; foto_id: number | null }[] };
      if (!String(g.bascula ?? '').trim()) f.push({ texto: 'Anote la balanza de los sacos.', id: 'balanza-manual' });
      g.pesadas.forEach((x, i) => {
        const n = g.pesadas.length > 1 ? ` de la pesada ${i + 1}` : '';
        if (!x.sacos || x.sacos < 1) f.push({ texto: `Anote la cantidad de sacos${n}.`, id: 'sacos' });
        if (!x.peso_kg || x.peso_kg <= 0) f.push({ texto: `Anote el peso${n} de los sacos.`, id: 'sacos' });
        if (!x.foto_id) f.push({ texto: `Tome la foto${n} en la balanza manual.`, id: 'sacos' });
      });
    }
    if (t === 'MIXTA' && this.reparto() && this.reparto()!.granel <= 0) {
      f.push({ texto: 'Los sacos pesan igual o más que el neto del camión: revise los pesos.', id: 'sacos' });
    }
    return f;
  }

  /** Avisos de lo que falta: se muestran desde que se intenta guardar. */
  readonly faltanVisibles = signal<{ texto: string; id: string }[]>([]);

  listo(): boolean { return this.faltantes().length === 0; }

  /** Lleva al campo que falta y lo resalta un momento. */
  irA(id: string): void {
    const anclas: Record<string, string> = { pesaje: 'app-pesaje-campos', sacos: 'app-sacos-campos' };
    const el = (anclas[id] ? document.querySelector(anclas[id]) : document.getElementById(id)) as HTMLElement | null;
    if (!el) return;
    const caja = (el.closest('.campo') as HTMLElement | null) ?? el;
    caja.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (typeof el.focus === 'function') setTimeout(() => el.focus({ preventScroll: true }), 300);
    caja.classList.add('resaltado');
    setTimeout(() => caja.classList.remove('resaltado'), 2500);
  }

  /**
   * Boletas leídas: si traen el productor y todavía no se eligió, se busca en
   * el catálogo; con un parecido alto se elige solo, si no se ofrecen opciones.
   */
  boletasLeidas(l: { interior: LecturaTicket | null; exterior: LecturaTicket | null }): void {
    this.lecturas = l;
    const nombre = l.interior?.campos.productor?.valor ?? l.exterior?.campos.productor?.valor;
    const texto = nombre ? String(nombre) : null;
    if (texto === this.nombreLeido()) return;
    this.nombreLeido.set(texto);
    this.parecidos.set([]);
    this.buscado.set(false);
    if (!texto || this.serie()?.origen !== 'COMPRA' || this.productor()) return;
    this.servicio.productoresParecidos(texto).subscribe((lista) => {
      this.buscado.set(true);
      if (lista.length && lista[0].parecido >= 0.75 && (lista.length === 1 || lista[1].parecido < lista[0].parecido - 0.15)) {
        this.usarParecido(lista[0]);
      } else {
        this.parecidos.set(lista);
      }
    });
  }

  usarParecido(x: ProductorParecido): void {
    const p = { id: x.id, nombre: x.nombre, ci: x.ci, cooperativa: x.cooperativa, activo: true } as unknown as Productor;
    this.productorTexto = p;
    this.elegirProductor(p);
    this.productorDeBoleta.set(true);
    this.parecidos.set([]);
  }

  /**
   * Antes de guardar, siempre (a mano, con Tesseract o con Claude), se
   * muestra todo lo anotado con la foto de la boleta y las diferencias contra
   * lo leído; se guarda solo cuando la persona confirma.
   */
  guardar(confirmado = false): void {
    // Si falta algo, se dice qué y dónde, en vez de dejar el botón apagado.
    const faltan = this.faltantes();
    this.faltanVisibles.set(faltan);
    if (faltan.length) {
      this.form.markAllAsTouched(); this.pesaje.markAllAsTouched(); this.sacos.markAllAsTouched();
      this.toast.add({ severity: 'warn', summary: faltan.length === 1 ? 'Falta un dato' : `Faltan ${faltan.length} datos`,
                       detail: faltan[0].texto, life: 6000 });
      this.irA(faltan[0].id);
      return;
    }
    const v = this.form.getRawValue();
    const conPesaje = this.tipoRecepcion === 'MIXTA' || (this.tipoRecepcion === 'BASCULA' && this.conPesaje);
    if (!confirmado) {
      const p = this.pesaje.getRawValue();
      this.diferencias.set(conPesaje ? diferenciasBoleta(this.lecturas.interior, this.lecturas.exterior,
        { placa: p.placa, chofer_nombre: p.chofer_nombre }, this.productor()?.nombre ?? null) : []);
      this.aConfirmar.set(conPesaje ? (p as PesajeAConfirmar) : null);
      this.valeAConfirmar.set(conPesaje ? this.camposPesaje?.vale() ?? null : null);
      const sacos = this.tipoRecepcion !== 'BASCULA' ? datosSacos(this.sacos, this.tipoRecepcion === 'SACOS') : null;
      const kgSacos = sacos ? sacos.pesadas.reduce((t, x) => t + (x.peso_kg ?? 0), 0) : 0;
      const nSacos = sacos ? sacos.pesadas.reduce((t, x) => t + (x.sacos ?? 0), 0) : 0;
      const mina = this.minas().find((m) => m.id === v.mina_id)?.nombre;
      this.extrasConfirmar.set([
        { etiqueta: 'Lote', valor: this.serie()?.proximo_codigo },
        { etiqueta: 'Tipo de recepción', valor: this.tipos.find((t) => t.valor === this.tipoRecepcion)?.etiqueta },
        { etiqueta: 'Acopio', valor: this.sedes().find((s) => s.id === v.almacen_id)?.nombre },
        ...(this.serie()?.origen === 'COMPRA' ? [{ etiqueta: 'Productor', valor: this.productor()?.nombre }] : []),
        ...(mina ? [{ etiqueta: 'Mina', valor: mina }] : []),
        { etiqueta: 'Material', valor: this.opciones()?.materiales.find((m) => m.valor === v.material)?.etiqueta ?? v.material },
        ...(sacos ? [{ etiqueta: this.tipoRecepcion === 'MIXTA' ? 'Sacos (otro lote)' : 'Sacos', valor:
            `${nSacos} sacos · ${this.fmt(kgSacos)} kg en ${sacos.pesadas.length} pesada${sacos.pesadas.length === 1 ? '' : 's'}` }] : []),
        ...(this.tipoRecepcion === 'MIXTA' && this.reparto() ? [{ etiqueta: 'Granel (este lote)', valor: `${this.fmt(this.reparto()!.granel)} kg` }] : []),
        ...(this.tipoRecepcion === 'SACOS' && sacos ? [{ etiqueta: 'Quién entrega', valor: sacos.chofer_nombre }] : []),
        ...(this.bonoLab() ? [{ etiqueta: 'Bono de laboratorio', valor: `Bs ${this.fmt(this.bonoLab()!.monto)}` }] : []),
      ]);
      this.confirmarVisible = true;
      return;
    }
    const datos: DatosRecepcion = {
      serie_id: v.serie_id!, almacen_id: v.almacen_id!,
      productor_id: this.serie()?.origen === 'COMPRA' ? this.productor()?.id ?? null : null,
      mina_id: v.mina_id, bocamina_id: v.bocamina_id, guia_transporte: v.guia_transporte, material: v.material, observaciones: v.observaciones,
      tipo_recepcion: this.tipoRecepcion,
      pesaje: this.tipoRecepcion === 'MIXTA' || (this.tipoRecepcion === 'BASCULA' && this.conPesaje)
        ? datosPesaje(this.pesaje) : null,
      sacos: this.tipoRecepcion === 'BASCULA' ? null : datosSacos(this.sacos, this.tipoRecepcion === 'SACOS'),
      lote_sacos: this.tipoRecepcion === 'MIXTA' ? { material: this.materialSacos, observaciones: this.observacionesSacos } : null,
    };

    this.guardando.set(true);
    this.servicio.recibir(datos).subscribe({
      next: (r) => {
        recordarBascula(datos.pesaje?.bascula);
        this.router.navigate(['/cargas/lotes', r.data.id], { state: { mensaje: r.mensaje } });
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se recibió el lote', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }
}
