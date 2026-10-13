import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { FotoService } from '../core/services/foto.service';
import { Foto, TIPOS_FOTO, TipoFoto } from '../core/models/foto.model';

/**
 * Galería de fotos de un activo.
 *
 * Pensada para usarse con el teléfono en la mano frente al bien: el botón de
 * cámara abre directamente la trasera, y la imagen se comprime antes de subir.
 */
@Component({
  selector: 'app-galeria-fotos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ButtonModule, DialogModule,
    DropdownModule, InputTextModule, ToastModule, ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <div class="encabezado-galeria">
      <div>
        <h3>Fotografías</h3>
        <p class="ayuda">
          {{ fotos().length }} de 6. La principal se muestra en los listados
          y al escanear el código QR.
        </p>
      </div>

      <div class="acciones" *ngIf="fotos().length < 6">
        <!-- capture abre la cámara trasera en el teléfono, en vez del
             selector de archivos -->
        <input type="file" id="camara" accept="image/*" capture="environment"
               hidden (change)="alElegir($event)" />
        <label for="camara" class="boton-camara">
          <i class="pi pi-camera"></i> Tomar foto
        </label>

        <input type="file" id="archivo" accept="image/*" hidden
               (change)="alElegir($event)" />
        <label for="archivo" class="boton-archivo">
          <i class="pi pi-upload"></i> Subir
        </label>
      </div>
    </div>

    <div class="cuadricula" *ngIf="fotos().length; else sinFotos">
      <figure class="tarjeta" *ngFor="let f of fotos()">
        <button type="button" class="imagen" (click)="abrir(f)">
          <img [src]="f.url_miniatura" [alt]="f.etiqueta_tipo" loading="lazy" />
          <span class="marca-principal" *ngIf="f.es_principal">
            <i class="pi pi-star-fill"></i> principal
          </span>
        </button>

        <figcaption>
          <div class="tipo">{{ f.etiqueta_tipo }}</div>
          <div class="fecha">{{ f.created_at | date: 'dd/MM/yyyy' }}</div>
          <div class="descripcion" *ngIf="f.descripcion">{{ f.descripcion }}</div>
        </figcaption>

        <div class="acciones-foto">
          <p-button *ngIf="!f.es_principal" icon="pi pi-star" [text]="true"
                    [rounded]="true" size="small" pTooltip="Marcar como principal"
                    (onClick)="marcarPrincipal(f)" />
          <p-button icon="pi pi-trash" [text]="true" [rounded]="true" size="small"
                    severity="danger" (onClick)="confirmarEliminar(f)" />
        </div>
      </figure>
    </div>

    <ng-template #sinFotos>
      <div class="vacio-fotos">
        <i class="pi pi-image"></i>
        <p>Sin fotografías</p>
        <small>
          Una foto permite confirmar que la etiqueta corresponde al bien, y deja
          constancia de su estado para cuando haga falta probarlo.
        </small>
      </div>
    </ng-template>

    <!-- Diálogo de carga -->
    <p-dialog [(visible)]="dialogSubir" header="Agregar fotografía" [modal]="true"
              [style]="{ width: '30rem' }" [draggable]="false">
      <div class="previsualizacion" *ngIf="previsualizacion()">
        <img [src]="previsualizacion()" alt="Vista previa" />
        <div class="peso" *ngIf="pesoComprimido()">
          {{ pesoOriginal() }} KB → <strong>{{ pesoComprimido() }} KB</strong>
        </div>
      </div>

      <div class="campo">
        <label for="tipo">Qué documenta</label>
        <p-dropdown inputId="tipo" [options]="tipos" optionLabel="etiqueta" optionValue="valor"
                    [(ngModel)]="tipo" appendTo="body" />
        <small>{{ ayudaDelTipo() }}</small>
      </div>

      <div class="campo">
        <label for="descripcion">Descripción</label>
        <input id="descripcion" pInputText [(ngModel)]="descripcion"
               placeholder="Opcional — ej. golpe en la tapa" />
      </div>

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" [text]="true" (onClick)="cancelar()" />
        <p-button label="Guardar" icon="pi pi-check" [loading]="subiendo()"
                  [disabled]="!comprimida()" (onClick)="subir()" />
      </ng-template>
    </p-dialog>

    <!-- Visor -->
    <p-dialog [(visible)]="dialogVisor" [modal]="true" [style]="{ width: '90vw', maxWidth: '50rem' }"
              [draggable]="false" [header]="fotoAbierta()?.etiqueta_tipo ?? ''">
      <img *ngIf="fotoAbierta() as f" [src]="f.url" class="visor" [alt]="f.etiqueta_tipo" />
      <p class="pie-visor" *ngIf="fotoAbierta() as f">
        {{ f.descripcion }}
        <span class="fecha">{{ f.created_at | date: 'dd/MM/yyyy HH:mm' }}</span>
      </p>
    </p-dialog>
  `,
  styles: [`
    .encabezado-galeria {
      display: flex; flex-wrap: wrap; gap: 1rem;
      align-items: flex-start; justify-content: space-between;
      margin-bottom: 1.25rem;
    }

    .encabezado-galeria h3 { margin: 0; font-size: 1rem; font-weight: 600; }

    .ayuda {
      margin: 0.25rem 0 0; font-size: 0.8rem;
      color: var(--text-color-secondary, #6b7280);
    }

    .acciones { display: flex; gap: 0.5rem; }

    .boton-camara, .boton-archivo {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.5rem 0.9rem; cursor: pointer;
      font-size: 0.85rem; font-weight: 550;
      border-radius: 6px;
    }

    .boton-camara {
      color: #fff;
      background: var(--primary-color, #3b82f6);
    }

    .boton-archivo {
      color: var(--text-color, #374151);
      background: var(--surface-ground, #f3f4f6);
      border: 1px solid var(--surface-border, #e5e7eb);
    }

    /* ─────────────────────────────────────────────────────── Cuadrícula */

    .cuadricula {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
      gap: 1rem;
    }

    .tarjeta {
      position: relative;
      margin: 0;
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #e5e7eb);
      border-radius: 10px;
      overflow: hidden;
    }

    .imagen {
      display: block; width: 100%; padding: 0;
      border: none; background: #f3f4f6; cursor: zoom-in;
      position: relative;
    }

    .imagen img {
      display: block; width: 100%; aspect-ratio: 4/3;
      object-fit: cover;
    }

    .marca-principal {
      position: absolute; top: 0.4rem; left: 0.4rem;
      display: inline-flex; align-items: center; gap: 0.25rem;
      padding: 0.15rem 0.4rem;
      font-size: 0.65rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.03em;
      color: #78350f; background: #fef3c7;
      border-radius: 4px;
    }

    figcaption { padding: 0.6rem 0.7rem 2.2rem; }

    .tipo { font-size: 0.8rem; font-weight: 550; }

    .fecha {
      font-size: 0.72rem;
      color: var(--text-color-secondary, #9ca3af);
    }

    .descripcion {
      margin-top: 0.3rem; font-size: 0.75rem; line-height: 1.35;
      color: var(--text-color-secondary, #6b7280);
    }

    .acciones-foto {
      position: absolute; bottom: 0.25rem; right: 0.25rem;
      display: flex;
    }

    /* ─────────────────────────────────────────────────────────── Vacío */

    .vacio-fotos {
      display: flex; flex-direction: column; align-items: center;
      gap: 0.5rem; padding: 3rem 1rem; text-align: center;
      border: 2px dashed var(--surface-border, #e5e7eb);
      border-radius: 10px;
    }

    .vacio-fotos i {
      font-size: 2.5rem; color: var(--surface-border, #d1d5db);
    }

    .vacio-fotos p {
      margin: 0; font-size: 0.95rem;
      color: var(--text-color-secondary, #6b7280);
    }

    .vacio-fotos small {
      max-width: 28rem; font-size: 0.8rem; line-height: 1.45;
      color: var(--text-color-secondary, #9ca3af);
    }

    /* ─────────────────────────────────────────────────────── Diálogos */

    .previsualizacion { margin-bottom: 1rem; text-align: center; }

    .previsualizacion img {
      max-width: 100%; max-height: 14rem;
      border-radius: 8px;
    }

    .peso {
      margin-top: 0.5rem; font-size: 0.78rem;
      color: var(--text-color-secondary, #6b7280);
    }

    .campo {
      display: flex; flex-direction: column; gap: 0.35rem;
      margin-bottom: 1rem;
    }

    .campo label { font-size: 0.8rem; font-weight: 550; }

    .campo small {
      font-size: 0.75rem; line-height: 1.4;
      color: var(--text-color-secondary, #9ca3af);
    }

    .campo :is(input, .p-dropdown) { width: 100%; }

    .visor { width: 100%; border-radius: 8px; }

    .pie-visor {
      margin: 0.75rem 0 0; font-size: 0.85rem;
      color: var(--text-color-secondary, #6b7280);
    }

    .pie-visor .fecha { display: block; margin-top: 0.25rem; }
  `],
})
export class GaleriaFotosComponent implements OnInit {
  @Input({ required: true }) activoId!: number;

  private readonly servicio = inject(FotoService);
  private readonly toast = inject(MessageService);
  private readonly confirm = inject(ConfirmationService);

  readonly fotos = signal<Foto[]>([]);
  readonly previsualizacion = signal<string | null>(null);
  readonly comprimida = signal<Blob | null>(null);
  readonly pesoOriginal = signal<number | null>(null);
  readonly pesoComprimido = signal<number | null>(null);
  readonly fotoAbierta = signal<Foto | null>(null);
  readonly subiendo = signal(false);

  readonly tipos = TIPOS_FOTO;

  tipo: TipoFoto = 'IDENTIFICACION';
  descripcion = '';
  dialogSubir = false;
  dialogVisor = false;

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.servicio.listar(this.activoId).subscribe({
      next: (f) => this.fotos.set(f),
    });
  }

  ayudaDelTipo(): string {
    return this.tipos.find((t) => t.valor === this.tipo)?.ayuda ?? '';
  }

  async alElegir(evento: Event): Promise<void> {
    const archivo = (evento.target as HTMLInputElement).files?.[0];
    if (!archivo) return;

    this.pesoOriginal.set(Math.round(archivo.size / 1024));

    try {
      const blob = await this.servicio.comprimir(archivo);

      this.comprimida.set(blob);
      this.pesoComprimido.set(Math.round(blob.size / 1024));
      this.previsualizacion.set(URL.createObjectURL(blob));
      this.dialogSubir = true;
    } catch {
      this.toast.add({
        severity: 'error', summary: 'No se pudo procesar la imagen',
      });
    }

    // Permite volver a elegir el mismo archivo.
    (evento.target as HTMLInputElement).value = '';
  }

  subir(): void {
    const blob = this.comprimida();
    if (!blob) return;

    this.subiendo.set(true);

    this.servicio
      .subir(this.activoId, blob, this.tipo, this.descripcion || undefined)
      .subscribe({
        next: () => {
          this.subiendo.set(false);
          this.cancelar();
          this.toast.add({ severity: 'success', summary: 'Fotografía agregada' });
          this.cargar();
        },
        error: (e) => {
          this.subiendo.set(false);
          this.toast.add({
            severity: 'error', summary: 'No se pudo guardar',
            detail: e?.error?.mensaje ?? '', life: 8000,
          });
        },
      });
  }

  cancelar(): void {
    const url = this.previsualizacion();
    if (url) URL.revokeObjectURL(url);

    this.dialogSubir = false;
    this.previsualizacion.set(null);
    this.comprimida.set(null);
    this.pesoOriginal.set(null);
    this.pesoComprimido.set(null);
    this.descripcion = '';
    this.tipo = 'IDENTIFICACION';
  }

  abrir(f: Foto): void {
    this.fotoAbierta.set(f);
    this.dialogVisor = true;
  }

  marcarPrincipal(f: Foto): void {
    this.servicio.marcarPrincipal(f.id).subscribe({
      next: (r) => {
        this.toast.add({ severity: 'success', summary: r.mensaje });
        this.cargar();
      },
    });
  }

  confirmarEliminar(f: Foto): void {
    this.confirm.confirm({
      header: 'Eliminar fotografía',
      message: f.es_principal
        ? 'Es la foto principal. Al eliminarla, otra ocupará su lugar.'
        : '¿Eliminar esta fotografía? No se puede recuperar.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      accept: () =>
        this.servicio.eliminar(f.id).subscribe({
          next: (r) => {
            this.toast.add({ severity: 'info', summary: r.mensaje });
            this.cargar();
          },
          error: (e) =>
            this.toast.add({
              severity: 'error', summary: 'No se pudo eliminar',
              detail: e?.error?.message ?? '',
            }),
        }),
    });
  }
}
