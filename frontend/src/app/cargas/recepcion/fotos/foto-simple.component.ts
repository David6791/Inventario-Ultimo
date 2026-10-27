import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject, input, output, signal } from '@angular/core';
import { mensajeDeError } from '../../core/errores';
import { abrirFoto, aBlob } from '../../core/imagen';
import { FotoRecepcion, TipoFoto } from '../../core/models/cargas.model';
import { RecepcionService } from '../../core/services/recepcion.service';

/**
 * Foto de respaldo sin lectura (el momento del pesaje en la balanza manual):
 * se toma, se reduce y se sube. Muestra la miniatura; tocarla la reemplaza.
 */
@Component({
  selector: 'app-foto-simple',
  standalone: true,
  imports: [CommonModule],
  template: `
    <label class="foto" [class.con-foto]="vista()" [class.subiendo]="subiendo()" [title]="vista() ? 'Cambiar la foto' : 'Tomar la foto'">
      <input type="file" accept="image/*" capture="environment" (change)="elegir($event)" [disabled]="subiendo()" />
      <img *ngIf="vista() as v" [src]="v" alt="Foto de la balanza" />
      <i *ngIf="!vista()" class="pi" [class.pi-camera]="!subiendo()" [class.pi-spin]="subiendo()" [class.pi-spinner]="subiendo()"></i>
      <span *ngIf="!vista() && etiqueta()">{{ etiqueta() }}</span>
    </label>
    <small class="error" *ngIf="error()">{{ error() }}</small>
  `,
  styles: [`
    :host { display: inline-flex; flex-direction: column; gap: 0.2rem; }
    .foto { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem;
            min-width: 3.2rem; height: 2.6rem; padding: 0 0.6rem; border: 1px dashed #94a3b8; border-radius: 6px;
            color: var(--primary-color, #2563eb); cursor: pointer; font-size: 0.82rem; font-weight: 600; overflow: hidden; }
    .foto.con-foto { padding: 0; border-style: solid; border-color: #10b981; width: 3.2rem; }
    .foto img { width: 100%; height: 100%; object-fit: cover; }
    .foto input { position: absolute; width: 1px; height: 1px; opacity: 0; }
    .foto.subiendo { opacity: 0.6; cursor: progress; }
    .error { color: #b91c1c; font-size: 0.75rem; max-width: 12rem; }
  `],
})
export class FotoSimpleComponent implements OnDestroy {
  readonly tipo = input<TipoFoto>('BALANZA_MANUAL');
  readonly etiqueta = input<string>('');
  readonly subida = output<FotoRecepcion>();

  private readonly servicio = inject(RecepcionService);
  readonly vista = signal<string | null>(null);
  readonly subiendo = signal(false);
  readonly error = signal<string | null>(null);

  async elegir(ev: Event): Promise<void> {
    const archivo = (ev.target as HTMLInputElement).files?.[0];
    (ev.target as HTMLInputElement).value = '';
    if (!archivo) return;
    this.subiendo.set(true);
    this.error.set(null);
    try {
      const blob = await aBlob(await abrirFoto(archivo, 1600), 0.82);
      this.servicio.subirFoto(this.tipo(), blob, null, null).subscribe({
        next: (f) => {
          this.subiendo.set(false);
          this.ponerVista(URL.createObjectURL(blob));
          this.subida.emit(f);
        },
        error: (e) => { this.subiendo.set(false); this.error.set(mensajeDeError(e)); },
      });
    } catch (e) {
      this.subiendo.set(false);
      this.error.set((e as Error).message);
    }
  }

  private ponerVista(url: string | null): void {
    const a = this.vista();
    if (a) URL.revokeObjectURL(a);
    this.vista.set(url);
  }

  ngOnDestroy(): void { this.ponerVista(null); }
}
