import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { QRCodeModule } from 'angularx-qrcode';
import { ActivoService } from '../core/services/activo.service';
import { EtiquetaActivo } from '../core/models/activo.model';

/**
 * Hoja de etiquetas para imprimir y pegar en los bienes.
 *
 * El QR lleva SOLO el código: todo lo demás se consulta al escanearlo. Así la
 * etiqueta no queda desactualizada cuando el bien cambia de custodio o de
 * ubicación, que es lo que más cambia.
 *
 * Se imprime desde el navegador en vez de generar un PDF en el servidor: da
 * control real sobre el tamaño del papel y evita sumar una dependencia de PHP.
 */
@Component({
  selector: 'app-etiquetas',
  standalone: true,
  imports: [CommonModule, ButtonModule, MessageModule, QRCodeModule],
  template: `
    <div class="no-imprimir">
      <div class="flex justify-content-between align-items-center mb-3">
        <div>
          <h2 class="m-0">Etiquetas</h2>
          <small class="text-color-secondary">{{ etiquetas().length }} etiqueta(s)</small>
        </div>
        <p-button label="Imprimir" icon="pi pi-print" (onClick)="imprimir()" />
      </div>

      <p-message
        severity="info" styleClass="w-full mb-3"
        text="Pegar en lugar visible que no comprometa la funcionalidad ni la garantía del bien. Si la etiqueta se deteriora, se reimprime con el MISMO código: el código no cambia nunca." />
    </div>

    <div class="hoja">
      <div class="etiqueta" *ngFor="let e of etiquetas()">
        <qrcode
          [qrdata]="e.codigo"
          [width]="90"
          [margin]="0"
          errorCorrectionLevel="M"
          elementType="svg"
        />
        <div class="datos">
          <div class="codigo">{{ e.codigo }}</div>
          <div class="denominacion">{{ e.denominacion }}</div>
          <div class="serie" *ngIf="e.serie">S/N {{ e.serie }}</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .hoja {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4mm;
    }

    .etiqueta {
      display: flex;
      align-items: center;
      gap: 3mm;
      border: 1px solid #999;
      border-radius: 2mm;
      padding: 3mm;
      height: 28mm;
      break-inside: avoid;
    }

    .datos { overflow: hidden; }

    .codigo {
      font-family: ui-monospace, monospace;
      font-weight: 700;
      font-size: 10pt;
      letter-spacing: -0.2px;
    }

    .denominacion {
      font-size: 8pt;
      line-height: 1.2;
      margin-top: 1mm;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .serie {
      font-family: ui-monospace, monospace;
      font-size: 7pt;
      color: #555;
      margin-top: 1mm;
    }

    @media print {
      .no-imprimir { display: none !important; }
      .hoja { gap: 3mm; }
      .etiqueta { border-color: #000; }
      @page { size: A4; margin: 8mm; }
    }
  `],
})
export class EtiquetasComponent implements OnInit {
  private readonly servicio = inject(ActivoService);
  private readonly ruta = inject(ActivatedRoute);

  readonly etiquetas = signal<EtiquetaActivo[]>([]);

  ngOnInit(): void {
    const ids = (this.ruta.snapshot.queryParamMap.get('ids') ?? '')
      .split(',')
      .map(Number)
      .filter((n) => !Number.isNaN(n) && n > 0);

    if (!ids.length) return;

    this.servicio.etiquetas(ids).subscribe((e) => this.etiquetas.set(e));
  }

  imprimir(): void {
    window.print();
  }
}
