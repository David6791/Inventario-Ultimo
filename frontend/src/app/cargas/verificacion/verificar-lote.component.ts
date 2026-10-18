import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

interface LoteVerificado {
  codigo: string;
  estado: string;
  anulado_en: string | null;
  motivo_anulacion: string | null;
  fecha_recepcion: string;
  linea: string | null;
  origen: 'COMPRA' | 'PROPIA';
  sede: string | null;
  productor: string | null;
  cooperativa: string | null;
  mina: string | null;
  bocamina: string | null;
  material: string | null;
  num_pesajes: number;
  num_sacos: number | null;
  peso_neto_kg: string;
  pesajes: { ticket: string; fecha: string; placa: string | null; num_sacos: number | null; peso_neto_kg: string; anulado: boolean }[];
  empresa: string;
  consultado_en: string;
}

/**
 * Lo que se ve al escanear el QR del rótulo de un lote: sin iniciar sesión,
 * pensado para el teléfono en el patio, con la carga delante.
 */
@Component({
  selector: 'app-verificar-lote',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pantalla">
      <p class="cargando" *ngIf="cargando()">Verificando el lote…</p>

      <div class="tarjeta" [class.falso]="e.invalido" *ngIf="error() as e">
        <div class="sello" *ngIf="e.invalido">✕</div>
        <h1>{{ e.titulo }}</h1>
        <p>{{ e.texto }}</p>
        <p class="nota" *ngIf="e.invalido">No acepte ni mueva esta carga sin consultar a recepción.</p>
      </div>

      <ng-container *ngIf="lote() as l">
        <div class="tarjeta" [class.valido]="l.estado !== 'ANULADO'" [class.falso]="l.estado === 'ANULADO'">
          <div class="sello">{{ l.estado === 'ANULADO' ? '!' : '✓' }}</div>
          <div class="empresa">{{ l.empresa }}</div>
          <div class="codigo">{{ l.codigo }}</div>
          <h1 *ngIf="l.estado !== 'ANULADO'">Lote registrado · {{ etiqueta(l.estado) }}</h1>
          <h1 *ngIf="l.estado === 'ANULADO'">Lote ANULADO</h1>
          <p *ngIf="l.estado === 'ANULADO'">El {{ l.anulado_en | date: 'dd/MM/yyyy HH:mm' }}: {{ l.motivo_anulacion }}</p>
          <p class="nota">Compare estos datos con el rótulo y con la carga que tiene delante.</p>
        </div>

        <dl class="tarjeta datos">
          <dt>Recibido</dt><dd>{{ l.fecha_recepcion | date: 'dd/MM/yyyy HH:mm' }} · {{ l.sede }}</dd>
          <dt>{{ l.origen === 'COMPRA' ? 'Productor' : 'Origen' }}</dt>
          <dd class="fuerte">{{ l.productor ?? 'Producción propia' }}</dd>
          <ng-container *ngIf="l.cooperativa"><dt>Cooperativa</dt><dd>{{ l.cooperativa }}</dd></ng-container>
          <dt>Mina</dt><dd>{{ l.mina ?? '—' }}{{ l.bocamina ? ' · bocamina ' + l.bocamina : '' }}</dd>
          <dt>Mineral</dt><dd>{{ l.linea }}{{ l.material ? ' · ' + l.material : '' }}</dd>
          <dt>Sacos</dt><dd class="fuerte mono">{{ l.num_sacos ?? '—' }}</dd>
          <dt>Peso neto húmedo</dt><dd class="fuerte mono">{{ kg(l.peso_neto_kg) }} kg</dd>
        </dl>

        <div class="tarjeta" *ngIf="l.pesajes.length">
          <h2>Pesajes ({{ l.num_pesajes }})</h2>
          <div class="pesaje" *ngFor="let p of l.pesajes" [class.tachado]="p.anulado">
            <span class="mono">{{ p.ticket }}</span>
            <span>{{ p.placa ?? 'Sin placa' }} · {{ p.fecha | date: 'dd/MM HH:mm' }}{{ p.anulado ? ' · anulado' : '' }}</span>
            <span class="mono derecha">{{ kg(p.peso_neto_kg) }} kg</span>
          </div>
        </div>
        <p class="pie">Consultado el {{ l.consultado_en | date: 'dd/MM/yyyy HH:mm:ss' }}</p>
      </ng-container>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: #f4f5f7; color: #1f2937; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
    .pantalla { max-width: 34rem; margin: 0 auto; padding: 1.25rem 1rem 3rem; }
    .cargando { text-align: center; color: #6b7280; margin-top: 3rem; }
    .tarjeta { background: #fff; border-radius: 14px; padding: 1.1rem 1.25rem; margin-bottom: 0.75rem; }
    .valido { border-left: 6px solid #15803d; }
    .falso { border-left: 6px solid #b91c1c; background: #fef2f2; }
    .sello { width: 2.6rem; height: 2.6rem; border-radius: 50%; display: grid; place-items: center; font-size: 1.4rem;
             font-weight: 700; color: #fff; background: #15803d; float: right; }
    .falso .sello { background: #b91c1c; }
    .empresa { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }
    .codigo { font-family: ui-monospace, Menlo, monospace; font-size: 1.6rem; font-weight: 700; margin: 0.2rem 0; }
    h1 { font-size: 1.05rem; margin: 0.2rem 0; }
    h2 { font-size: 0.85rem; margin: 0 0 0.5rem; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
    p { margin: 0.4rem 0 0; font-size: 0.92rem; }
    .nota { font-size: 0.8rem; color: #6b7280; }
    .datos { display: grid; grid-template-columns: 9rem 1fr; gap: 0.55rem 0.8rem; margin: 0 0 0.75rem; }
    dt { font-size: 0.75rem; text-transform: uppercase; color: #6b7280; padding-top: 0.15rem; }
    dd { margin: 0; }
    .fuerte { font-weight: 650; font-size: 1.05rem; }
    .mono { font-family: ui-monospace, Menlo, monospace; }
    .pesaje { display: grid; grid-template-columns: 6rem 1fr auto; gap: 0.5rem; font-size: 0.88rem; padding: 0.4rem 0; border-top: 1px solid #f1f5f9; }
    .tachado { color: #9ca3af; text-decoration: line-through; }
    .derecha { text-align: right; }
    .pie { text-align: center; font-size: 0.75rem; color: #9ca3af; }
  `],
})
export class VerificarLoteComponent implements OnInit {
  readonly codigo = input.required<string>();
  private readonly http = inject(HttpClient);

  readonly lote = signal<LoteVerificado | null>(null);
  readonly error = signal<{ titulo: string; texto: string; invalido: boolean } | null>(null);
  readonly cargando = signal(true);

  ngOnInit(): void {
    this.http.get<{ data: LoteVerificado }>(`${environment.apiUrl}/cargas/verificar/${this.codigo()}`).subscribe({
      next: (r) => { this.lote.set(r.data); this.cargando.set(false); },
      error: (e) => {
        this.cargando.set(false);
        if (e?.status === 404) {
          this.error.set({ titulo: 'Rótulo no válido', invalido: true,
                           texto: e?.error?.mensaje ?? 'Este código no corresponde a ningún lote registrado.' });
        } else if (e?.status === 429) {
          this.error.set({ titulo: 'Espere un momento', invalido: false,
                           texto: 'Hubo demasiadas consultas seguidas. Espere un minuto y vuelva a escanear.' });
        } else {
          this.error.set({ titulo: 'No se pudo verificar ahora', invalido: false,
                           texto: 'No hay conexión con el sistema. Revise la señal e intente de nuevo; esto no significa que el rótulo sea falso.' });
        }
      },
    });
  }

  kg(v: string | number): string {
    return Number(v).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  etiqueta(e: string): string {
    return ({ RECIBIDO: 'recibido', MUESTREADO: 'muestreado', ANALIZADO: 'analizado', LIQUIDADO: 'liquidado' } as Record<string, string>)[e] ?? e;
  }
}
