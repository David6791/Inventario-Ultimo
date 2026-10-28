import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TienePermisoDirective } from '../../shared/directives/tiene-permiso.directive';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { Esquinas, abrirFoto, aBlob, detectarEsquinas, enderezar, proporcionDe } from '../core/imagen';
import { CampoDisponible, CampoTicket, LecturaTicket, PlantillaBascula, RecuadroPlantilla } from '../core/models/cargas.model';
import { RecepcionService } from '../core/services/recepcion.service';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';
import { forkJoin } from 'rxjs';
import { EscanerService } from '../core/services/escaner.service';
import { EsquinasFotoComponent } from '../recepcion/fotos/esquinas-foto.component';

type Uso = PlantillaBascula['uso'];
interface Borrador { id: number | null; nombre: string; bascula: string; uso: Uso; activa: boolean; proporcion: number; campos: RecuadroPlantilla[]; }

const COLORES: Record<CampoTicket, string> = {
  ticket: '#7c3aed', peso_bruto_kg: '#2563eb', tara_kg: '#ea580c', peso_neto_kg: '#059669', placa: '#db2777', fecha: '#0891b2',
  numero_orden: '#6d28d9', productor: '#b45309', chofer: '#0f766e', hora: '#0e7490',
};

/**
 * Plantillas de báscula. Por cada balanza (son cuatro) se sube una foto de un
 * ticket, se endereza por sus esquinas y se dibuja con el ratón o el dedo el
 * recuadro de cada dato: ticket, bruto, tara, neto… Los recuadros se guardan
 * como fracciones del ticket, así sirven para cualquier foto enderezada a la
 * misma proporción. «Probar lectura» lee la foto con Tesseract en el servidor;
 * «Comparar con Claude» la lee además con la API de Claude, lado a lado.
 */
@Component({
  selector: 'app-plantillas-bascula',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, CheckboxModule, DropdownModule, InputNumberModule, InputTextModule,
            ToastModule, TienePermisoDirective, EsquinasFotoComponent],
  providers: [MessageService],
  template: `
    <p-toast />
    <header class="encabezado">
      <div>
        <h2>Plantillas de báscula</h2>
        <p class="subtitulo">Dónde está cada dato en el ticket de cada balanza. Con ellas se leen solas las fotos de los tickets.</p>
      </div>
      <p-button *appTienePermiso="'cargas.catalogos'" label="Nueva plantilla" icon="pi pi-plus" (onClick)="nueva()" [disabled]="!!borrador()" />
    </header>

    <div class="aviso-ocr" *ngIf="ocr() === false">
      <i class="pi pi-exclamation-triangle"></i>
      Tesseract no está instalado en el servidor: las fotos se guardan pero no se leen. Reconstruya la imagen del contenedor de la aplicación.
    </div>

    <!-- Lista -->
    <div class="lista" *ngIf="!borrador()">
      <div class="vacio" *ngIf="!plantillas().length">Todavía no hay plantillas. Cree una por cada balanza con una foto de su ticket.</div>
      <article class="plantilla" *ngFor="let p of plantillas()" [class.inactiva]="!p.activa">
        <div class="mini">
          <img *ngIf="miniaturas()[p.id] as m" [src]="m" alt="" />
          <i *ngIf="!miniaturas()[p.id]" class="pi pi-image"></i>
        </div>
        <div class="info">
          <h3>{{ p.nombre }}</h3>
          <div class="secundario">Báscula <span class="codigo">{{ p.bascula }}</span> · {{ etiquetaUso(p.uso) }}</div>
          <div class="chips">
            <span class="chip" *ngFor="let c of p.campos" [style.borderColor]="color(c.campo)">{{ nombreCampo(c.campo) }}</span>
            <span class="pastilla" *ngIf="!p.activa">Inactiva</span>
          </div>
        </div>
        <p-button *appTienePermiso="'cargas.catalogos'" icon="pi pi-pencil" [text]="true" (onClick)="editar(p)" ariaLabel="Editar plantilla" />
      </article>
    </div>

    <!-- Editor -->
    <section class="editor" *ngIf="borrador() as b">
      <div class="campos datos">
        <div class="campo span-2"><label for="pl-nombre">Nombre</label>
          <input id="pl-nombre" pInputText [(ngModel)]="b.nombre" maxlength="60" placeholder="Balanza San Cristóbal" /></div>
        <div class="campo span-2"><label for="pl-bascula">Báscula (se guarda en el pesaje)</label>
          <input id="pl-bascula" pInputText [(ngModel)]="b.bascula" maxlength="40" class="codigo" /></div>
        <div class="campo span-1"><label for="pl-uso">Uso</label>
          <p-dropdown inputId="pl-uso" [(ngModel)]="b.uso" [options]="usos" optionLabel="etiqueta" optionValue="valor" appendTo="body"
                      [style]="{ width: '100%' }" /></div>
        <div class="campo span-1 check-campo"><p-checkbox [(ngModel)]="b.activa" [binary]="true" inputId="pl-activa" />
          <label for="pl-activa">Activa</label></div>
      </div>

      <!-- Foto de muestra -->
      <div class="paso" *ngIf="!muestra() && !fotoCruda()">
        <label class="elegir">
          <input type="file" accept="image/*" capture="environment" (change)="elegirFoto($event, 'muestra')" />
          <i class="pi pi-camera"></i>
          <span>1. Tome o elija una foto clara de un ticket de esta balanza</span>
        </label>
        <p-button *ngIf="escaner.estado()?.escaneres?.length" label="O escanear un ticket" icon="pi pi-print" [text]="true"
                  [loading]="escaneando()" (onClick)="escanearFoto('muestra')" />
      </div>

      <div class="paso" *ngIf="fotoCruda() as f">
        <h4>{{ fotoPara() === 'muestra' ? '2. Ajuste las esquinas del ticket' : 'Ajuste las esquinas del ticket de prueba' }}</h4>
        <app-esquinas-foto [foto]="f" [(esquinas)]="esquinas" />
        <div class="acciones">
          <p-button label="Cancelar" [text]="true" (onClick)="fotoCruda.set(null)" />
          <p-button label="Enderezar" icon="pi pi-check" (onClick)="enderezarFoto()" />
        </div>
      </div>

      <div class="trabajo" *ngIf="muestra() as m">
        <div class="lienzo-col">
          <div class="herramientas">
            <span class="secundario">3. Elija un dato y dibuje su recuadro sobre el ticket:</span>
            <div class="botones-campo">
              <button type="button" *ngFor="let c of camposDisponibles()" class="boton-campo" [class.activo]="dibujando() === c.campo"
                      [style.--color]="color(c.campo)" (click)="dibujando.set(dibujando() === c.campo ? null : c.campo)">
                <i class="pi" [class.pi-check]="tiene(b, c.campo)" [class.pi-plus]="!tiene(b, c.campo)"></i>{{ c.etiqueta }}
              </button>
            </div>
          </div>
          <div class="lienzo" #lienzo [class.dibujando]="dibujando()" (pointerdown)="empezar($event)">
            <img [src]="m.url" alt="Ticket de muestra enderezado" draggable="false" />
            <div class="caja" *ngFor="let r of b.campos" [class.elegida]="elegido() === r.campo"
                 [style.left.%]="r.x * 100" [style.top.%]="r.y * 100" [style.width.%]="r.w * 100" [style.height.%]="r.h * 100"
                 [style.--color]="color(r.campo)" (pointerdown)="elegir($event, r.campo)">
              <span>{{ nombreCampo(r.campo) }}<b *ngIf="lectura()?.campos?.[r.campo] as l">: {{ l.valor ?? '¿?' }}</b></span>
            </div>
            <div class="caja nueva" *ngIf="nuevaCaja() as n" [style.left.%]="n.x * 100" [style.top.%]="n.y * 100"
                 [style.width.%]="n.w * 100" [style.height.%]="n.h * 100" [style.--color]="color(dibujando()!)"></div>
          </div>
          <small class="secundario">Proporción del ticket: {{ b.proporcion | number: '1.3-3' }} (ancho/alto). Deje un pequeño margen alrededor de cada dato.</small>
        </div>

        <aside class="panel">
          <ng-container *ngIf="seleccion() as r; else sinSeleccion">
            <h4 [style.color]="color(r.campo)">{{ nombreCampo(r.campo) }}</h4>
            <div class="campo"><label for="pl-etiqueta">Etiqueta impresa <span class="opcional">(respaldo)</span></label>
              <input id="pl-etiqueta" pInputText [(ngModel)]="r.etiqueta" maxlength="30" placeholder="BRUTO" />
              <small class="secundario">Si el recuadro no se lee, se busca este texto en el ticket y se toma lo que sigue.</small></div>
            <div class="campo" *ngIf="esNumero(r.campo)"><label for="pl-dec">Decimales que imprime</label>
              <p-inputNumber inputId="pl-dec" [(ngModel)]="r.decimales" [min]="0" [max]="3" [showButtons]="true" [useGrouping]="false" /></div>
            <div class="campo"><label for="pl-desenfoque">Suavizado</label>
              <p-dropdown inputId="pl-desenfoque" [(ngModel)]="r.desenfoque" [options]="suavizados" optionLabel="etiqueta" optionValue="valor"
                          appendTo="body" [style]="{ width: '100%' }" placeholder="Normal (1)" />
              <small class="secundario">Para impresoras de puntos (matriciales) suba el suavizado: une los puntos de cada número.</small></div>
            <div class="campo check-campo" *ngIf="r.campo === 'ticket'"><p-checkbox [(ngModel)]="r.letras" [binary]="true" inputId="pl-letras" />
              <label for="pl-letras">El número de ticket lleva letras</label></div>
            <p-button label="Quitar recuadro" icon="pi pi-trash" severity="danger" [text]="true" (onClick)="quitar(r.campo)" />
          </ng-container>
          <ng-template #sinSeleccion><p class="secundario">Toque un recuadro para ajustar cómo se lee.</p></ng-template>

          <div class="prueba">
            <h4>Probar lectura</h4>
            <div class="acciones-prueba">
              <p-button label="Con esta foto" icon="pi pi-play" size="small" [loading]="probando()" [disabled]="!b.campos.length" (onClick)="probar()" />
              <label class="p-button p-button-sm p-button-outlined boton-archivo">
                <input type="file" accept="image/*" capture="environment" (change)="elegirFoto($event, 'prueba')" />
                <i class="pi pi-camera"></i>&nbsp;Con otra foto
              </label>
              <p-button *ngIf="escaner.estado()?.escaneres?.length" label="Escanear otra" icon="pi pi-print" size="small" [outlined]="true"
                        [loading]="escaneando()" (onClick)="escanearFoto('prueba')" />
              <p-button *ngIf="claude()" label="Comparar con Claude" icon="pi pi-sparkles" size="small" severity="help" [outlined]="true"
                        [loading]="comparando()" [disabled]="!b.campos.length || probando()" (onClick)="comparar()" />
            </div>
            <small class="secundario" *ngIf="claude() === false">Para comparar con Claude, configure ANTHROPIC_API_KEY en el servidor.</small>

            <!-- Tesseract y Claude lado a lado -->
            <ng-container *ngIf="comparacion() as cmp; else soloTesseract">
              <table class="comparacion">
                <thead><tr><th>Campo</th><th>Tesseract</th><th>Claude</th><th></th></tr></thead>
                <tbody>
                  <tr *ngFor="let f of cmp.filas" [class.distinto]="f.distinto">
                    <td [style.color]="color(f.campo)">{{ nombreCampo(f.campo) }}</td>
                    <td class="codigo">{{ f.tesseract ?? (f.conRecuadro ? 'no se leyó' : 'sin recuadro') }}</td>
                    <td class="codigo">{{ f.claude ?? 'no se leyó' }}</td>
                    <td><i class="pi" [class.pi-check]="!f.distinto" [class.pi-times]="f.distinto" [title]="f.distinto ? 'Distinto' : 'Igual'"></i></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr><td>Bruto − tara = neto</td><td>{{ cmp.t.coherente === true ? 'cuadra' : cmp.t.coherente === false ? 'no cuadra' : '—' }}</td>
                      <td>{{ cmp.c.coherente === true ? 'cuadra' : cmp.c.coherente === false ? 'no cuadra' : '—' }}</td><td></td></tr>
                  <tr><td>Tiempo</td><td>{{ seg(cmp.t.segundos) }}</td><td>{{ seg(cmp.c.segundos) }}</td><td></td></tr>
                  <tr *ngIf="cmp.c.uso"><td>Tokens</td><td>—</td>
                      <td>{{ (cmp.c.uso.entrada + cmp.c.uso.salida).toLocaleString('es-BO') }}
                        <small>({{ cmp.c.uso.entrada.toLocaleString('es-BO') }} entrada · {{ cmp.c.uso.salida.toLocaleString('es-BO') }} salida)</small></td><td></td></tr>
                  <tr *ngIf="cmp.c.uso?.imagen"><td>Imagen enviada</td><td>—</td><td>{{ cmp.c.uso!.imagen }} px</td><td></td></tr>
                </tfoot>
              </table>
              <small class="secundario">{{ cmp.iguales }} de {{ cmp.filas.length }} datos iguales{{ cmp.c.modelo ? ' · ' + cmp.c.modelo : '' }}.</small>
              <div class="mal" *ngFor="let a of cmp.c.avisos"><i class="pi pi-sparkles"></i> {{ a }}</div>
              <div class="mal" *ngFor="let a of cmp.t.avisos"><i class="pi pi-th-large"></i> {{ a }}</div>
            </ng-container>
            <ng-template #soloTesseract>
            <ng-container *ngIf="lectura() as l">
              <div class="resultado" *ngFor="let r of b.campos">
                <span [style.color]="color(r.campo)">{{ nombreCampo(r.campo) }}</span>
                <span class="codigo">{{ l.campos[r.campo]?.valor ?? 'no se leyó' }}</span>
                <span class="conf">{{ metodo(l, r.campo) }}</span>
              </div>
              <div class="ok" *ngIf="l.coherente === true"><i class="pi pi-check-circle"></i> Bruto − tara = neto</div>
              <div class="mal" *ngFor="let a of l.avisos"><i class="pi pi-exclamation-triangle"></i> {{ a }}</div>
            </ng-container>
            </ng-template>
          </div>
          <p-button label="Cambiar foto de muestra" icon="pi pi-camera" [text]="true" size="small" (onClick)="cambiarMuestra()" />
        </aside>
      </div>

      <div class="pie">
        <p-button label="Cancelar" [text]="true" (onClick)="cerrar()" />
        <p-button label="Guardar plantilla" icon="pi pi-check" [loading]="guardando()" [disabled]="!puedeGuardar()" (onClick)="guardar()" />
      </div>
    </section>
  `,
  styles: [ESTILOS_CARGAS, `
    .aviso-ocr { display: flex; gap: 0.5rem; align-items: center; padding: 0.6rem 0.9rem; border-radius: 8px; background: #fef3c7; color: #92400e; margin-bottom: 1rem; }
    .lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr)); gap: 0.8rem; }
    .vacio { color: var(--text-color-secondary, #6b7280); padding: 2rem 0; }
    .plantilla { display: grid; grid-template-columns: 4.2rem 1fr auto; gap: 0.8rem; align-items: center; padding: 0.8rem;
                 border: 1px solid var(--surface-border, #e5e7eb); border-radius: 10px; background: var(--surface-card, #fff); }
    .plantilla.inactiva { opacity: 0.6; }
    .plantilla h3 { margin: 0 0 0.15rem; font-size: 0.98rem; }
    .mini { width: 4.2rem; height: 5.4rem; border-radius: 6px; background: var(--surface-ground, #f1f5f9); display: grid; place-items: center; overflow: hidden; }
    .mini img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
    .chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem; }
    .chip { font-size: 0.7rem; border: 1.5px solid; border-radius: 999px; padding: 0.05rem 0.5rem; }
    .editor { border: 1px solid var(--surface-border, #e5e7eb); border-radius: 10px; padding: 1rem 1.2rem; background: var(--surface-card, #fff); }
    .datos { margin-bottom: 1rem; }
    .paso { margin: 0.5rem 0 1rem; max-width: 40rem; }
    .paso h4 { margin: 0 0 0.5rem; font-size: 0.92rem; }
    .elegir { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 2rem 1rem; cursor: pointer; text-align: center;
              border: 1px dashed #94a3b8; border-radius: 10px; color: var(--primary-color, #2563eb); font-weight: 600; }
    .elegir i { font-size: 2rem; }
    .elegir input, .boton-archivo input { position: absolute; width: 1px; height: 1px; opacity: 0; }
    .acciones { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }
    .trabajo { display: grid; grid-template-columns: minmax(0, 1fr) 19rem; gap: 1.2rem; align-items: start; }
    @media (max-width: 900px) { .trabajo { grid-template-columns: 1fr; } }
    .herramientas { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 0.5rem; }
    .botones-campo { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .boton-campo { display: inline-flex; gap: 0.3rem; align-items: center; border: 1.5px solid var(--color); color: var(--color);
                   background: #fff; border-radius: 999px; padding: 0.3rem 0.7rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
    .boton-campo.activo { background: var(--color); color: #fff; }
    .lienzo { position: relative; line-height: 0; max-width: 34rem; touch-action: none; user-select: none; border: 1px solid var(--surface-border, #e5e7eb); }
    .lienzo.dibujando { cursor: crosshair; }
    .lienzo img { width: 100%; height: auto; pointer-events: none; }
    .caja { position: absolute; border: 2px solid var(--color); background: color-mix(in srgb, var(--color) 14%, transparent); cursor: pointer; }
    .caja.elegida { box-shadow: 0 0 0 3px color-mix(in srgb, var(--color) 35%, transparent); }
    .caja.nueva { border-style: dashed; pointer-events: none; }
    .caja span { position: absolute; left: -2px; bottom: 100%; background: var(--color); color: #fff; font: 600 11px/1.5 system-ui, sans-serif;
                 padding: 0 0.35rem; white-space: nowrap; border-radius: 3px 3px 0 0; }
    .panel { display: flex; flex-direction: column; gap: 0.8rem; }
    .panel h4 { margin: 0; font-size: 0.95rem; }
    .panel .campo { display: flex; flex-direction: column; gap: 0.3rem; }
    .panel .campo label { font-size: 0.8rem; font-weight: 550; }
    .prueba { border-top: 1px solid var(--surface-border, #e5e7eb); padding-top: 0.8rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .acciones-prueba { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .boton-archivo { position: relative; cursor: pointer; }
    .resultado { display: grid; grid-template-columns: 4.5rem 1fr auto; gap: 0.4rem; font-size: 0.85rem; }
    .conf { font-size: 0.72rem; color: var(--text-color-secondary, #6b7280); }
    .ok { color: #047857; font-size: 0.82rem; }
    .comparacion { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    .comparacion th { text-align: left; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-color-secondary, #6b7280);
                      padding: 0.25rem 0.3rem; border-bottom: 1px solid var(--surface-border, #e5e7eb); }
    .comparacion td { padding: 0.25rem 0.3rem; border-bottom: 1px solid var(--surface-border, #f1f5f9); word-break: break-word; }
    .comparacion tr.distinto td { background: #fff7ed; }
    .comparacion .pi-check { color: #047857; } .comparacion .pi-times { color: #c2410c; }
    .comparacion tfoot td { color: var(--text-color-secondary, #6b7280); font-size: 0.76rem; }
    .secundario { color: var(--text-color-secondary, #6b7280); font-size: 0.76rem; }
    .mal { color: #92400e; font-size: 0.82rem; }
    .pie { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.2rem; }
    .opcional { font-weight: 400; color: var(--text-color-secondary, #9ca3af); }
    .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
  `],
})
export class PlantillasBasculaComponent implements OnInit {
  private readonly servicio = inject(RecepcionService);
  private readonly toast = inject(MessageService);
  readonly escaner = inject(EscanerService);
  readonly escaneando = signal(false);

  @ViewChild('lienzo') private lienzo?: ElementRef<HTMLDivElement>;

  readonly plantillas = signal<PlantillaBascula[]>([]);
  readonly camposDisponibles = signal<CampoDisponible[]>([]);
  readonly ocr = signal<boolean | null>(null);
  readonly miniaturas = signal<Record<number, string>>({});

  readonly borrador = signal<Borrador | null>(null);
  readonly muestra = signal<{ url: string; blob: Blob } | null>(null);
  private muestraNueva = false;
  readonly fotoCruda = signal<HTMLCanvasElement | null>(null);
  readonly fotoPara = signal<'muestra' | 'prueba'>('muestra');
  esquinas: Esquinas = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

  readonly dibujando = signal<CampoTicket | null>(null);
  readonly elegido = signal<CampoTicket | null>(null);
  readonly nuevaCaja = signal<{ x: number; y: number; w: number; h: number } | null>(null);
  readonly lectura = signal<LecturaTicket | null>(null);
  readonly probando = signal(false);
  readonly comparando = signal(false);
  readonly lecturaClaude = signal<LecturaTicket | null>(null);
  /** null mientras no se sabe; false si el servidor no tiene la clave de Claude. */
  readonly claude = signal<boolean | null>(null);
  private ultimaPrueba: Blob | null = null;
  private readonly catalogos = inject(CatalogosCargasService);

  /** Tesseract y Claude sobre la misma foto, campo por campo. */
  readonly comparacion = computed(() => {
    const t = this.lectura(), c = this.lecturaClaude();
    this.version();
    if (!t || !c) return null;
    const recuadros = new Set((this.borrador()?.campos ?? []).map((r) => r.campo));
    const orden = this.camposDisponibles().map((x) => x.campo);
    const campos = orden.filter((k) => recuadros.has(k) || c.campos[k]?.valor != null);
    const texto = (v: number | string | null | undefined) => v == null || v === '' ? null : typeof v === 'number' ? v.toLocaleString('es-BO') : String(v);
    const norma = (v: string | null) => v === null ? null : v.toUpperCase().replace(/[^0-9A-ZÁÉÍÓÚÑ]/g, '');
    const filas = campos.map((k) => {
      const a = texto(t.campos[k]?.valor), b = texto(c.campos[k]?.valor);
      return { campo: k, tesseract: a, claude: b, conRecuadro: recuadros.has(k), distinto: norma(a) !== norma(b) };
    });
    return { filas, t, c, iguales: filas.filter((f) => !f.distinto).length };
  });

  seg(s: number | null | undefined): string { return s == null ? '—' : `${s.toLocaleString('es-BO')} s`; }
  readonly guardando = signal(false);
  private readonly version = signal(0);

  readonly seleccion = computed(() => {
    this.version();
    return this.borrador()?.campos.find((c) => c.campo === this.elegido()) ?? null;
  });

  readonly usos = [
    { valor: 'INTERIOR', etiqueta: 'Interior (empresa)' },
    { valor: 'EXTERIOR', etiqueta: 'Exterior (cliente)' },
    { valor: 'AMBAS', etiqueta: 'Ambas' },
  ];
  readonly suavizados = [
    { valor: 0, etiqueta: 'Ninguno (0)' }, { valor: 1, etiqueta: 'Normal (1)' }, { valor: 2, etiqueta: 'Matricial (2)' },
    { valor: 3, etiqueta: 'Matricial fuerte (3)' },
  ];

  ngOnInit(): void {
    this.cargar();
    this.escaner.revisar();
    this.catalogos.opciones$.subscribe((o) => this.claude.set(!!o.lector_claude));
  }

  async escanearFoto(para: 'muestra' | 'prueba'): Promise<void> {
    this.escaneando.set(true);
    try {
      const c = await abrirFoto(await this.escaner.escanear(300, true), 2600);
      this.esquinas = detectarEsquinas(c);
      this.fotoPara.set(para);
      this.fotoCruda.set(c);
    } catch (e) {
      this.toast.add({ severity: 'error', summary: 'No se pudo escanear', detail: (e as Error).message, life: 9000 });
    } finally {
      this.escaneando.set(false);
    }
  }

  private cargar(): void {
    this.servicio.plantillas().subscribe((r) => {
      this.plantillas.set(r.data);
      this.camposDisponibles.set(r.campos);
      this.ocr.set(r.ocr);
      for (const p of r.data) {
        if (p.tiene_muestra && !this.miniaturas()[p.id]) {
          this.servicio.muestraPlantilla(p.id).subscribe((b) =>
            this.miniaturas.update((m) => ({ ...m, [p.id]: URL.createObjectURL(b) })));
        }
      }
    });
  }

  etiquetaUso(u: Uso): string { return this.usos.find((x) => x.valor === u)?.etiqueta ?? u; }
  nombreCampo(c: CampoTicket): string { return this.camposDisponibles().find((x) => x.campo === c)?.etiqueta ?? c; }
  color(c: CampoTicket): string { return COLORES[c] ?? '#475569'; }
  esNumero(c: CampoTicket): boolean { return this.camposDisponibles().find((x) => x.campo === c)?.tipo === 'numero'; }
  tiene(b: Borrador, c: CampoTicket): boolean { return b.campos.some((r) => r.campo === c); }
  metodo(l: LecturaTicket, c: CampoTicket): string {
    const x = l.campos[c];
    if (!x) return '';
    if (x.valor === null) return '';
    if (x.metodo !== 'recuadro') return x.metodo;
    return x.verificado ? 'cuadra' : x.confianza > 0 ? `${x.confianza} %` : 'revisar';
  }

  nueva(): void {
    this.borrador.set({ id: null, nombre: '', bascula: '', uso: 'INTERIOR', activa: true, proporcion: 0.7, campos: [] });
    this.ponerMuestra(null);
    this.lectura.set(null); this.lecturaClaude.set(null); this.ultimaPrueba = null;
  }

  editar(p: PlantillaBascula): void {
    this.borrador.set({ id: p.id, nombre: p.nombre, bascula: p.bascula, uso: p.uso, activa: p.activa, proporcion: p.proporcion,
                        campos: p.campos.map((c) => ({ ...c })) });
    this.lectura.set(null); this.lecturaClaude.set(null); this.ultimaPrueba = null;
    this.ponerMuestra(null);
    if (p.tiene_muestra) this.servicio.muestraPlantilla(p.id).subscribe((b) => { this.ponerMuestra(b); this.muestraNueva = false; });
  }

  cerrar(): void {
    this.borrador.set(null);
    this.ponerMuestra(null);
    this.fotoCruda.set(null);
    this.elegido.set(null);
    this.dibujando.set(null);
  }

  cambiarMuestra(): void {
    this.ponerMuestra(null);
    this.lectura.set(null); this.lecturaClaude.set(null); this.ultimaPrueba = null;
  }

  private ponerMuestra(b: Blob | null): void {
    const a = this.muestra();
    if (a) URL.revokeObjectURL(a.url);
    this.muestra.set(b ? { url: URL.createObjectURL(b), blob: b } : null);
  }

  async elegirFoto(ev: Event, para: 'muestra' | 'prueba'): Promise<void> {
    const archivo = (ev.target as HTMLInputElement).files?.[0];
    (ev.target as HTMLInputElement).value = '';
    if (!archivo) return;
    const c = await abrirFoto(archivo);
    this.esquinas = detectarEsquinas(c);
    this.fotoPara.set(para);
    this.fotoCruda.set(c);
  }

  async enderezarFoto(): Promise<void> {
    const c = this.fotoCruda(), b = this.borrador();
    if (!c || !b) return;
    if (this.fotoPara() === 'muestra') {
      b.proporcion = Math.round(proporcionDe(this.esquinas) * 10000) / 10000;
      const blob = await aBlob(enderezar(c, this.esquinas, b.proporcion));
      this.ponerMuestra(blob);
      this.muestraNueva = true;
      this.fotoCruda.set(null);
    } else {
      const blob = await aBlob(enderezar(c, this.esquinas, b.proporcion));
      this.fotoCruda.set(null);
      this.probar(blob);
    }
  }

  // ---------------------------------------------------------------- Dibujo
  private punto(ev: PointerEvent): { x: number; y: number } {
    const r = this.lienzo!.nativeElement.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)) };
  }

  empezar(ev: PointerEvent): void {
    const campo = this.dibujando();
    if (!campo || !this.lienzo) return;
    ev.preventDefault();
    const el = this.lienzo.nativeElement;
    el.setPointerCapture(ev.pointerId);
    const inicio = this.punto(ev);
    this.nuevaCaja.set({ ...inicio, w: 0, h: 0 });
    const mover = (e: PointerEvent) => {
      const p = this.punto(e);
      this.nuevaCaja.set({ x: Math.min(inicio.x, p.x), y: Math.min(inicio.y, p.y), w: Math.abs(p.x - inicio.x), h: Math.abs(p.y - inicio.y) });
    };
    const soltar = () => {
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerup', soltar);
      el.removeEventListener('pointercancel', soltar);
      const n = this.nuevaCaja();
      this.nuevaCaja.set(null);
      const b = this.borrador();
      if (!n || !b || n.w < 0.02 || n.h < 0.008) return;
      const r4 = (v: number) => Math.round(v * 10000) / 10000;
      const anterior = b.campos.find((c) => c.campo === campo);
      const caja: RecuadroPlantilla = { ...(anterior ?? {}), campo, x: r4(n.x), y: r4(n.y), w: r4(n.w), h: r4(n.h) };
      if (!anterior && campo !== 'ticket' && campo !== 'placa' && campo !== 'fecha') {
        caja.etiqueta = ({ peso_bruto_kg: 'BRUTO', tara_kg: 'TARA', peso_neto_kg: 'NETO' } as Record<string, string>)[campo];
      }
      b.campos = [...b.campos.filter((c) => c.campo !== campo), caja];
      this.elegido.set(campo);
      this.dibujando.set(this.siguienteSinDibujar(b));
      this.version.update((v) => v + 1);
    };
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
  }

  private siguienteSinDibujar(b: Borrador): CampoTicket | null {
    const orden: CampoTicket[] = ['ticket', 'peso_bruto_kg', 'tara_kg', 'peso_neto_kg'];
    return orden.find((c) => !b.campos.some((r) => r.campo === c)) ?? null;
  }

  elegir(ev: PointerEvent, campo: CampoTicket): void {
    if (this.dibujando()) return;       // dibujando: el lienzo toma el evento
    ev.stopPropagation();
    this.elegido.set(campo);
  }

  quitar(campo: CampoTicket): void {
    const b = this.borrador();
    if (!b) return;
    b.campos = b.campos.filter((c) => c.campo !== campo);
    this.elegido.set(null);
    this.version.update((v) => v + 1);
  }

  // ---------------------------------------------------------------- Prueba y guardado
  probar(imagen?: Blob): void {
    const b = this.borrador(), m = this.muestra();
    const foto = imagen ?? m?.blob;
    if (!b || !foto) return;
    this.ultimaPrueba = foto;
    this.lecturaClaude.set(null);
    this.probando.set(true);
    this.servicio.probarPlantilla(foto, b.campos).subscribe({
      next: (l) => { this.probando.set(false); this.lectura.set(l); },
      error: (e) => { this.probando.set(false); this.toast.add({ severity: 'error', summary: 'No se pudo probar', detail: mensajeDeError(e) }); },
    });
  }

  /** Lee la última foto probada (o la muestra) con los dos lectores a la vez. */
  comparar(): void {
    const b = this.borrador();
    const foto = this.ultimaPrueba ?? this.muestra()?.blob;
    if (!b || !foto) return;
    this.ultimaPrueba = foto;
    this.comparando.set(true);
    forkJoin([this.servicio.probarPlantilla(foto, b.campos, 'tesseract'), this.servicio.probarPlantilla(foto, b.campos, 'claude')]).subscribe({
      next: ([t, c]) => { this.comparando.set(false); this.lectura.set(t); this.lecturaClaude.set(c); },
      error: (e) => { this.comparando.set(false); this.toast.add({ severity: 'error', summary: 'No se pudo comparar', detail: mensajeDeError(e) }); },
    });
  }

  puedeGuardar(): boolean {
    this.version();
    const b = this.borrador();
    return !!b && b.nombre.trim().length > 0 && b.bascula.trim().length > 0 && !!this.muestra() && b.campos.length > 0 && !this.guardando();
  }

  guardar(): void {
    const b = this.borrador();
    if (!b) return;
    this.guardando.set(true);
    const { id, ...datos } = b;
    this.servicio.guardarPlantilla(id, datos, this.muestraNueva ? this.muestra()?.blob ?? null : null).subscribe({
      next: (r) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'success', summary: r.mensaje });
        if (r.data.id && this.miniaturas()[r.data.id]) {
          this.miniaturas.update((m) => { const x = { ...m }; delete x[r.data.id]; return x; });
        }
        this.cerrar();
        this.cargar();
      },
      error: (e) => {
        this.guardando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se guardó la plantilla', detail: mensajeDeError(e), life: 10000 });
      },
    });
  }
}
