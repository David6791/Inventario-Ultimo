import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { mensajeDeError } from '../../core/errores';
import { Esquinas, abrirFoto, aBlob, detectarEsquinas, enderezar, proporcionDe, reducir } from '../../core/imagen';
import { CampoTicket, FotoRecepcion, LecturaTicket, PlantillaBascula, TipoFoto } from '../../core/models/cargas.model';
import { RecepcionService } from '../../core/services/recepcion.service';
import { EscanerService } from '../../core/services/escaner.service';
import { EsquinasFotoComponent } from './esquinas-foto.component';

export interface TicketLeido { foto: FotoRecepcion; plantilla: PlantillaBascula | null; lectura: LecturaTicket | null; }

const NOMBRES: Record<CampoTicket, string> = {
  ticket: 'Ticket', peso_bruto_kg: 'Bruto', tara_kg: 'Tara', peso_neto_kg: 'Neto', placa: 'Placa', fecha: 'Fecha',
  numero_orden: 'Orden', productor: 'Productor', chofer: 'Chofer', hora: 'Hora',
};
const CLAVE_PLANTILLA = 'cargas.plantilla.';

/**
 * Foto de un ticket de báscula: se toma (o se elige), se ajustan las cuatro
 * esquinas, se endereza a la proporción de la plantilla de esa balanza y se
 * sube. El servidor la lee con Tesseract y devuelve los datos para llenar el
 * formulario; la persona los revisa. La foto queda de respaldo en el pesaje.
 */
@Component({
  selector: 'app-foto-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DropdownModule, EsquinasFotoComponent],
  template: `
    <div class="foto-ticket" [class.lista]="leido()">
      <div class="cabeza">
        <span class="titulo"><i class="pi pi-camera"></i> {{ titulo() }}
          <span class="obligatoria" *ngIf="obligatoria()">obligatoria</span></span>
        <p-dropdown *ngIf="plantillasDelUso().length" [options]="plantillasDelUso()" [(ngModel)]="plantillaId" optionLabel="nombre"
                    optionValue="id" placeholder="Balanza" appendTo="body" [disabled]="subiendo()" styleClass="balanza"
                    (onChange)="recordarPlantilla()" [ariaLabel]="'Balanza del ' + titulo()" />
      </div>

      <!-- 1. Sin foto -->
      <div class="origenes" *ngIf="!foto() && !leido()">
        <button type="button" class="elegir escanear" *ngIf="escaner.estado()?.escaneres?.length" (click)="escanear()" [disabled]="escaneando()">
          <i class="pi" [class.pi-print]="!escaneando()" [class.pi-spin]="escaneando()" [class.pi-spinner]="escaneando()"></i>
          <span>{{ escaneando() ? 'Escaneando…' : 'Escanear la boleta' }}</span>
        </button>
        <label class="elegir">
          <input type="file" accept="image/*" capture="environment" (change)="elegir($event)" />
          <i class="pi pi-camera"></i>
          <span>{{ escaner.estado()?.escaneres?.length ? 'O tomar o elegir una foto' : 'Tomar o elegir la foto del ticket' }}</span>
        </label>
      </div>

      <!-- 2. Ajustar esquinas -->
      <ng-container *ngIf="foto() as f">
        <app-esquinas-foto [foto]="f" [(esquinas)]="esquinas" />
        <div class="acciones">
          <p-button label="Otra foto" [text]="true" icon="pi pi-refresh" (onClick)="cancelar()" [disabled]="subiendo()" />
          <p-button [label]="plantilla() ? 'Enderezar y leer' : 'Enderezar y subir'" icon="pi pi-check" [loading]="subiendo()"
                    (onClick)="subir()" />
        </div>
        <small class="secundario" *ngIf="!plantilla()">Sin plantilla de balanza la foto queda de respaldo pero los datos se anotan a mano.</small>
      </ng-container>

      <!-- 3. Leída -->
      <ng-container *ngIf="leido() as l">
        <div class="resultado">
          <img [src]="vista()" alt="Ticket enderezado" *ngIf="vista()" (click)="ampliado.set(!ampliado())" [class.ampliado]="ampliado()" />
          <div class="datos">
            <ng-container *ngIf="l.lectura as lec; else sinLectura">
              <div class="dato" *ngFor="let d of datosLeidos()" [class.dudoso]="d.dudoso">
                <span class="nombre">{{ d.nombre }}</span>
                <span class="valor codigo">{{ d.valor ?? '—' }}</span>
                <span class="conf" [title]="'Confianza de la lectura: ' + d.confianza + ' %'">{{ d.metodo }}</span>
              </div>
              <div class="aviso ok" *ngIf="lec.coherente === true"><i class="pi pi-check-circle"></i> Bruto − tara = neto.</div>
              <div class="aviso" *ngFor="let a of lec.avisos"><i class="pi pi-exclamation-triangle"></i> {{ a }}</div>
              <small class="secundario">Revise cada dato contra el ticket antes de guardar.</small>
            </ng-container>
            <ng-template #sinLectura><small class="secundario">Foto guardada. Anote los datos mirando el ticket.</small></ng-template>
            <p-button label="Tomar otra" [text]="true" size="small" icon="pi pi-refresh" (onClick)="cancelar()" />
          </div>
        </div>
      </ng-container>

      <small class="error" *ngIf="error()">{{ error() }}</small>
    </div>
  `,
  styles: [`
    .foto-ticket { border: 1px dashed var(--surface-border, #cbd5e1); border-radius: 10px; padding: 0.75rem; background: var(--surface-ground, #f8fafc); }
    .foto-ticket.lista { border-style: solid; background: var(--surface-card, #fff); }
    .cabeza { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
    .titulo { font-weight: 600; font-size: 0.88rem; display: flex; gap: 0.4rem; align-items: center; }
    .obligatoria { font-size: 0.7rem; font-weight: 600; color: #92400e; background: #fef3c7; border-radius: 4px; padding: 0.05rem 0.35rem; }
    :host ::ng-deep .balanza { min-width: 12rem; }
    .elegir { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; padding: 1.2rem 0.5rem; cursor: pointer;
              border-radius: 8px; color: var(--primary-color, #2563eb); font-weight: 600; font-size: 0.9rem; text-align: center; }
    .elegir:hover { background: rgba(37, 99, 235, 0.06); }
    .origenes { display: flex; gap: 0.5rem; }
    .origenes > * { flex: 1; }
    button.elegir { border: 0; background: none; font: inherit; }
    .escanear { background: rgba(37, 99, 235, 0.07) !important; }
    .elegir i { font-size: 1.6rem; }
    .elegir input { position: absolute; width: 1px; height: 1px; opacity: 0; }
    .acciones { display: flex; justify-content: flex-end; gap: 0.4rem; margin-top: 0.4rem; }
    .resultado { display: grid; grid-template-columns: minmax(6rem, 9rem) 1fr; gap: 0.8rem; align-items: start; }
    .resultado img { width: 100%; border-radius: 6px; border: 1px solid var(--surface-border, #e5e7eb); cursor: zoom-in; }
    .resultado img.ampliado { grid-column: 1 / -1; cursor: zoom-out; }
    .datos { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
    .dato { display: grid; grid-template-columns: 3.8rem 1fr auto; gap: 0.4rem; align-items: baseline; font-size: 0.88rem; }
    .dato .nombre { color: var(--text-color-secondary, #6b7280); font-size: 0.78rem; }
    .dato .valor { font-weight: 650; }
    .dato .conf { font-size: 0.7rem; color: #047857; }
    .dato.dudoso .valor { color: #b45309; }
    .dato.dudoso .conf { color: #b45309; }
    .aviso { display: flex; gap: 0.35rem; font-size: 0.8rem; color: #92400e; }
    .aviso.ok { color: #047857; }
    .secundario { color: var(--text-color-secondary, #6b7280); font-size: 0.78rem; }
    .error { color: #b91c1c; display: block; margin-top: 0.4rem; }
    .codigo { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }
    @media (max-width: 520px) { .resultado { grid-template-columns: 1fr; } .resultado img { max-height: 14rem; object-fit: contain; } }
  `],
})
export class FotoTicketComponent implements OnInit, OnDestroy {
  readonly tipo = input.required<TipoFoto>();
  readonly plantillas = input<PlantillaBascula[]>([]);
  readonly obligatoria = input(false);
  readonly listo = output<TicketLeido>();
  readonly quitado = output<void>();

  private readonly servicio = inject(RecepcionService);
  readonly escaner = inject(EscanerService);
  readonly escaneando = signal(false);
  /** De dónde salió la imagen: del escáner se recuerdan las esquinas (el ticket va siempre en el mismo lugar). */
  private origen: 'foto' | 'escaner' = 'foto';

  readonly foto = signal<HTMLCanvasElement | null>(null);
  readonly leido = signal<TicketLeido | null>(null);
  readonly subiendo = signal(false);
  readonly error = signal<string | null>(null);
  readonly vista = signal<string | null>(null);
  readonly ampliado = signal(false);
  esquinas: Esquinas = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  plantillaId: number | null = null;

  readonly titulo = computed(() => this.tipo() === 'TICKET_EXTERIOR' ? 'Ticket exterior (cliente)' : 'Ticket interior (empresa)');
  readonly plantillasDelUso = computed(() => {
    const uso = this.tipo() === 'TICKET_EXTERIOR' ? 'EXTERIOR' : 'INTERIOR';
    const lista = this.plantillas().filter((p) => p.activa && (p.uso === uso || p.uso === 'AMBAS'));
    if (this.plantillaId === null || !lista.some((p) => p.id === this.plantillaId)) {
      let guardada: number | null = null;
      try { guardada = Number(localStorage.getItem(CLAVE_PLANTILLA + this.tipo())) || null; } catch { /* sin almacenamiento */ }
      this.plantillaId = lista.find((p) => p.id === guardada)?.id ?? (lista.length === 1 ? lista[0].id : null);
    }
    return lista;
  });

  plantilla(): PlantillaBascula | null {
    return this.plantillas().find((p) => p.id === this.plantillaId) ?? null;
  }

  datosLeidos() {
    const l = this.leido()?.lectura;
    if (!l) return [];
    return (Object.keys(l.campos) as CampoTicket[]).map((k) => {
      const c = l.campos[k]!;
      const numero = typeof c.valor === 'number';
      return {
        nombre: NOMBRES[k] ?? k,
        valor: c.valor === null ? null : numero ? (c.valor as number).toLocaleString('es-BO') : c.valor,
        confianza: c.confianza,
        metodo: c.valor === null ? 'no se leyó' : c.metodo === 'calculado' ? 'calculado' : c.metodo === 'corregido' ? 'corregido'
          : c.verificado ? 'cuadra' : c.confianza > 0 ? `${c.confianza} %` : 'revisar',
        dudoso: !c.verificado && (c.valor === null || c.metodo !== 'recuadro' || c.confianza < 70),
      };
    });
  }

  recordarPlantilla(): void {
    try { if (this.plantillaId) localStorage.setItem(CLAVE_PLANTILLA + this.tipo(), String(this.plantillaId)); } catch { /* sin almacenamiento */ }
  }

  ngOnInit(): void { this.escaner.revisar(); }

  async escanear(): Promise<void> {
    this.escaneando.set(true);
    this.error.set(null);
    try {
      const blob = await this.escaner.escanear(300, true);
      const c = await abrirFoto(blob, 2600);
      this.origen = 'escaner';
      this.esquinas = this.esquinasGuardadas(c) ?? detectarEsquinas(c);
      this.foto.set(c);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.escaneando.set(false);
    }
  }

  private claveEsquinas(): string { return `cargas.esquinas-escaner.${this.plantillaId ?? 'sin-plantilla'}`; }

  private esquinasGuardadas(c: HTMLCanvasElement): Esquinas | null {
    try {
      const g = JSON.parse(localStorage.getItem(this.claveEsquinas()) ?? 'null') as { x: number; y: number }[] | null;
      return g?.length === 4 ? (g.map((p) => ({ x: p.x * c.width, y: p.y * c.height })) as Esquinas) : null;
    } catch { return null; }
  }

  private guardarEsquinas(c: HTMLCanvasElement): void {
    try {
      localStorage.setItem(this.claveEsquinas(), JSON.stringify(this.esquinas.map((p) => ({ x: p.x / c.width, y: p.y / c.height }))));
    } catch { /* sin almacenamiento */ }
  }

  async elegir(ev: Event): Promise<void> {
    const archivo = (ev.target as HTMLInputElement).files?.[0];
    (ev.target as HTMLInputElement).value = '';
    if (!archivo) return;
    this.error.set(null);
    try {
      const c = await abrirFoto(archivo);
      this.origen = 'foto';
      this.esquinas = detectarEsquinas(c);
      this.foto.set(c);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async subir(): Promise<void> {
    const c = this.foto();
    if (!c) return;
    const plantilla = this.plantilla();
    this.subiendo.set(true);
    this.error.set(null);
    try {
      const recto = enderezar(c, this.esquinas, plantilla?.proporcion ?? proporcionDe(this.esquinas));
      if (this.origen === 'escaner') this.guardarEsquinas(c);
      const [imagen, original] = await Promise.all([aBlob(recto), aBlob(reducir(c, 1600), 0.8)]);
      this.servicio.subirFoto(this.tipo(), imagen, original, plantilla?.id ?? null).subscribe({
        next: (foto) => {
          this.subiendo.set(false);
          this.foto.set(null);
          this.ponerVista(URL.createObjectURL(imagen));
          const r: TicketLeido = { foto, plantilla, lectura: foto.lectura ?? null };
          this.leido.set(r);
          this.listo.emit(r);
        },
        error: (e) => { this.subiendo.set(false); this.error.set(mensajeDeError(e)); },
      });
    } catch (e) {
      this.subiendo.set(false);
      this.error.set((e as Error).message);
    }
  }

  cancelar(): void {
    const habia = this.leido() !== null;
    this.foto.set(null);
    this.leido.set(null);
    this.ponerVista(null);
    this.error.set(null);
    if (habia) this.quitado.emit();
  }

  private ponerVista(url: string | null): void {
    const anterior = this.vista();
    if (anterior) URL.revokeObjectURL(anterior);
    this.vista.set(url);
  }

  ngOnDestroy(): void { this.ponerVista(null); }
}
