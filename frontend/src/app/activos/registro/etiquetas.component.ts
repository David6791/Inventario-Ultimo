import { CommonModule } from '@angular/common';
import {
  AfterViewChecked, Component, OnInit, inject, signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { QRCodeModule } from 'angularx-qrcode';
import JsBarcode from 'jsbarcode';
import { ActivoService } from '../core/services/activo.service';
import { CatalogoService } from '../core/services/catalogo.service';
import { ActivoLista } from '../core/models/activo.model';

/**
 * Etiquetas de identificación de bienes.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * POR QUÉ DOS CÓDIGOS
 *
 * El QR lleva la URL de consulta: cualquier teléfono lo escanea y abre la
 * ficha completa, con foto, ubicación y custodio. Es para quien tiene el bien
 * delante y necesita saber de qué se trata.
 *
 * El código de barras lleva solo el código. Es para el inventario físico con
 * lector de pistola: el aparato actúa como teclado, escribe el código en el
 * campo y pasa al siguiente bien. Escanear doscientos activos con la cámara
 * del teléfono es impracticable; con pistola toma veinte minutos.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * POR QUÉ DOS COLUMNAS Y NO TRES
 *
 * Un Code 128 de 19 caracteres necesita unos 90 mm de ancho para que las
 * barras tengan el grosor mínimo que un lector común reconoce sin fallar.
 *
 * A tres columnas por A4 quedan 58 mm por etiqueta y las barras salen
 * demasiado finas: el lector falla una de cada tres veces, que en una toma
 * física de doscientos bienes es insoportable.
 *
 * Diez etiquetas por hoja en vez de veintiuna es más papel. Un código que no
 * se lee es peor.
 */
@Component({
  selector: 'app-etiquetas',
  standalone: true,
  imports: [CommonModule, ButtonModule, QRCodeModule],
  template: `
    <div class="barra no-imprimir">
      <div>
        <button class="volver" type="button" (click)="volver()">
          <i class="pi pi-arrow-left"></i> Activos fijos
        </button>
        <h2>Etiquetas</h2>
        <p class="ayuda">
          {{ activos().length }} etiqueta(s), 10 por hoja A4. Recorte por las guías.
          El QR abre la ficha del bien; el código de barras es para el lector
          de pistola en la toma física.
        </p>
      </div>

      <div class="acciones">
        <p-button label="Imprimir" icon="pi pi-print" (onClick)="imprimir()" />
      </div>
    </div>

    <div class="aviso no-imprimir" *ngIf="!baseConsulta()">
      <i class="pi pi-exclamation-triangle"></i>
      <span>
        El parámetro <strong>URL_CONSULTA_QR</strong> no está configurado. Las etiquetas
        usarán la dirección de este navegador, que puede no ser accesible desde otros
        equipos.
      </span>
    </div>

    <div class="hoja">
      <div class="etiqueta" *ngFor="let a of activos()">

        <header class="empresa">
          <span class="nombre-empresa">{{ nombreEmpresa() }}</span>
          <span class="rotulo">Activo fijo</span>
        </header>

        <div class="cuerpo">
          <qrcode
            [qrdata]="urlDe(a.codigo)"
            [width]="96"
            [margin]="0"
            errorCorrectionLevel="M"
            elementType="svg"
          />

          <div class="datos">
            <div class="denominacion">{{ a.denominacion }}</div>
            <dl class="detalle">
              <ng-container *ngIf="a.marca || a.modelo">
                <dt>Equipo</dt>
                <dd>{{ a.marca }} {{ a.modelo }}</dd>
              </ng-container>
              <ng-container *ngIf="a.serie">
                <dt>Serie</dt>
                <dd class="mono">{{ a.serie }}</dd>
              </ng-container>
            </dl>
          </div>
        </div>

        <footer class="barras">
          <svg [attr.data-codigo]="a.codigo" class="codigo-barras"></svg>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; padding: 1.5rem; }

    .barra {
      display: flex; flex-wrap: wrap; gap: 1rem;
      align-items: flex-start; justify-content: space-between;
      margin-bottom: 1.5rem;
    }

    .volver {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0; margin-bottom: 0.5rem; font-size: 0.82rem;
      color: var(--text-color-secondary, #6b7280);
      background: none; border: none; cursor: pointer;
    }

    .barra h2 { margin: 0; font-size: 1.5rem; font-weight: 650; }

    .ayuda {
      margin: 0.35rem 0 0; max-width: 52ch;
      font-size: 0.85rem; line-height: 1.45;
      color: var(--text-color-secondary, #6b7280);
    }

    .aviso {
      display: flex; gap: 0.6rem; align-items: flex-start;
      padding: 0.75rem 0.9rem; margin-bottom: 1.25rem;
      font-size: 0.82rem; line-height: 1.45;
      color: #92400e; background: #fffbeb;
      border-left: 3px solid #f59e0b; border-radius: 6px;
    }

    /* ─────────────────────────────────────────────────── Las etiquetas */

    .hoja {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4mm;
    }

    .etiqueta {
      display: flex;
      flex-direction: column;
      padding: 3mm;
      background: #fff;
      border: 1px dashed #9ca3af;
      border-radius: 1.5mm;
      break-inside: avoid;
    }

    /* ── Encabezado con el nombre de la empresa ── */

    .empresa {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 2mm;
      padding-bottom: 1.5mm;
      margin-bottom: 2mm;
      border-bottom: 0.4mm solid #1f4e79;
    }

    .nombre-empresa {
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: #1f4e79;
      line-height: 1.15;
    }

    .rotulo {
      flex-shrink: 0;
      font-size: 5.5pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #6b7280;
    }

    /* ── QR y datos ── */

    .cuerpo {
      display: flex;
      gap: 3mm;
      align-items: flex-start;
      flex: 1;
      margin-bottom: 2mm;
    }

    .datos { flex: 1; min-width: 0; }

    .denominacion {
      font-size: 8.5pt;
      font-weight: 650;
      line-height: 1.2;
      /* Dos líneas: una denominación larga no debe empujar el código de
         barras fuera de la etiqueta. */
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .detalle {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.3mm 1.5mm;
      margin: 1.5mm 0 0;
      font-size: 6pt;
      line-height: 1.3;
    }

    .detalle dt {
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .detalle dd {
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mono { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }

    /* ── Código de barras ── */

    .barras {
      display: flex;
      justify-content: center;
      padding-top: 1.5mm;
      border-top: 0.2mm solid #e5e7eb;
    }

    .codigo-barras { width: 100%; max-width: 88mm; height: auto; }

    /* ────────────────────────────────────────────────────── Impresión */

    @media print {
      .no-imprimir { display: none !important; }

      :host { padding: 0; }

      .hoja { gap: 3mm; }

      .etiqueta { border-color: #d1d5db; }

      @page {
        size: A4;
        margin: 8mm;
      }
    }
  `],
})
export class EtiquetasComponent implements OnInit, AfterViewChecked {
  private readonly servicio = inject(ActivoService);
  private readonly parametros = inject(CatalogoService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly activos = signal<ActivoLista[]>([]);
  readonly baseConsulta = signal<string>('');
  readonly nombreEmpresa = signal<string>('');

  /** Evita redibujar los códigos en cada ciclo de detección de cambios. */
  private barrasDibujadas = false;

  ngOnInit(): void {
    this.cargarParametros();

    const ids = (this.ruta.snapshot.queryParamMap.get('ids') ?? '')
      .split(',')
      .map((n) => Number(n))
      .filter((n) => n > 0);

    if (! ids.length) {
      return;
    }

    this.servicio.listar({ por_pagina: 200 }).subscribe({
      next: (r) => {
        this.activos.set(r.data.filter((a) => ids.includes(a.id)));
        this.barrasDibujadas = false;
      },
    });
  }

  /**
   * Los códigos de barras se dibujan sobre los SVG ya renderizados, así que
   * hay que esperar a que Angular los ponga en el DOM.
   */
  ngAfterViewChecked(): void {
    if (this.barrasDibujadas || ! this.activos().length) {
      return;
    }

    const elementos = document.querySelectorAll<SVGElement>('.codigo-barras');

    if (! elementos.length) {
      return;
    }

    elementos.forEach((svg) => {
      const codigo = svg.getAttribute('data-codigo');
      if (! codigo) return;

      JsBarcode(svg, codigo, {
        format: 'CODE128',
        // 1.6 px por módulo: con 88 mm de ancho útil da barras de ~0,33 mm,
        // que es el mínimo que un lector común reconoce sin fallar.
        width: 1.6,
        height: 34,
        displayValue: true,
        font: 'monospace',
        fontSize: 13,
        textMargin: 1,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      });
    });

    this.barrasDibujadas = true;
  }

  private cargarParametros(): void {
    this.parametros.listarParametros().subscribe({
      next: (lista) => {
        const valor = (clave: string) =>
          lista.find((p) => p.clave === clave)?.valor ?? '';

        this.baseConsulta.set(valor('URL_CONSULTA_QR'));
        this.nombreEmpresa.set(valor('NOMBRE_EMPRESA') || valor('SIGLA_EMPRESA'));
      },
      error: () => {
        this.baseConsulta.set('');
        this.nombreEmpresa.set('');
      },
    });
  }

  urlDe(codigo: string): string {
    const base = this.baseConsulta() || window.location.origin;
    return `${base.replace(/\/+$/, '')}/a/${codigo}`;
  }

  imprimir(): void {
    window.print();
  }

  volver(): void {
    this.router.navigate(['/activos/registro']);
  }
}