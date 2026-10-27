import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnChanges, ViewChild, input, model, signal } from '@angular/core';
import { Esquinas, Punto } from '../../core/imagen';

/**
 * Muestra la foto y cuatro esquinas que se arrastran con el dedo o el ratón
 * hasta las puntas del ticket. Las coordenadas son de la foto (no de la
 * pantalla), listas para enderezar.
 */
@Component({
  selector: 'app-esquinas-foto',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="marco" #marco>
      <canvas #lienzo></canvas>
      <svg class="capa" [attr.viewBox]="'0 0 ' + ancho() + ' ' + alto()" preserveAspectRatio="none">
        <polygon [attr.points]="poligono()" />
      </svg>
      <button type="button" *ngFor="let p of esquinas(); let i = index" class="punta"
              [style.left.%]="(p.x / ancho()) * 100" [style.top.%]="(p.y / alto()) * 100"
              [attr.aria-label]="nombres[i]" (pointerdown)="tomar($event, i)">
        <span>{{ i + 1 }}</span>
      </button>
    </div>
    <p class="ayuda">Lleve cada punto a una esquina del ticket: 1 arriba a la izquierda, 2 arriba a la derecha,
      3 abajo a la derecha, 4 abajo a la izquierda.</p>
  `,
  styles: [`
    :host { display: block; }
    .marco { position: relative; width: 100%; touch-action: none; user-select: none; line-height: 0; }
    canvas { width: 100%; height: auto; border-radius: 6px; background: #111; }
    .capa { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .capa polygon { fill: rgba(37, 99, 235, 0.12); stroke: #2563eb; }
    .capa polygon { stroke-width: 2px; }
    .punta { position: absolute; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%;
             border: 3px solid #fff; background: #2563eb; color: #fff; font: 700 13px/1 system-ui, sans-serif;
             box-shadow: 0 1px 6px rgba(0,0,0,.45); cursor: grab; padding: 0; touch-action: none; }
    .punta:active { cursor: grabbing; transform: scale(1.15); }
    .ayuda { font-size: 0.8rem; color: var(--text-color-secondary, #6b7280); margin: 0.4rem 0 0; }
  `],
})
export class EsquinasFotoComponent implements AfterViewInit, OnChanges {
  readonly foto = input.required<HTMLCanvasElement>();
  readonly esquinas = model.required<Esquinas>();

  @ViewChild('lienzo') private lienzo!: ElementRef<HTMLCanvasElement>;
  @ViewChild('marco') private marco!: ElementRef<HTMLDivElement>;

  readonly ancho = signal(1);
  readonly alto = signal(1);
  readonly nombres = ['Esquina superior izquierda', 'Esquina superior derecha', 'Esquina inferior derecha', 'Esquina inferior izquierda'];

  poligono(): string {
    return this.esquinas().map((p) => `${p.x},${p.y}`).join(' ');
  }

  ngAfterViewInit(): void { this.dibujar(); }
  ngOnChanges(): void { if (this.lienzo) this.dibujar(); }

  private dibujar(): void {
    const f = this.foto();
    const c = this.lienzo.nativeElement;
    c.width = f.width; c.height = f.height;
    c.getContext('2d')!.drawImage(f, 0, 0);
    this.ancho.set(f.width);
    this.alto.set(f.height);
  }

  tomar(ev: PointerEvent, i: number): void {
    ev.preventDefault();
    const boton = ev.currentTarget as HTMLElement;
    boton.setPointerCapture(ev.pointerId);
    const mover = (e: PointerEvent) => {
      const r = this.marco.nativeElement.getBoundingClientRect();
      const p: Punto = {
        x: Math.min(this.ancho(), Math.max(0, ((e.clientX - r.left) / r.width) * this.ancho())),
        y: Math.min(this.alto(), Math.max(0, ((e.clientY - r.top) / r.height) * this.alto())),
      };
      const nuevas = [...this.esquinas()] as Esquinas;
      nuevas[i] = p;
      this.esquinas.set(nuevas);
    };
    const soltar = () => {
      boton.removeEventListener('pointermove', mover);
      boton.removeEventListener('pointerup', soltar);
      boton.removeEventListener('pointercancel', soltar);
    };
    boton.addEventListener('pointermove', mover);
    boton.addEventListener('pointerup', soltar);
    boton.addEventListener('pointercancel', soltar);
  }
}
