import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ESTILOS_CARGAS } from '../core/estilos';
import { EstadoModulo } from '../core/models/cargas.model';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';

/** Comprobación de punta a punta: el frontend llega a la API y la base tiene el módulo completo. */
@Component({
  selector: 'app-estado-cargas',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule],
  template: `
    <header class="encabezado">
      <div>
        <h2>Estado del módulo</h2>
        <p class="subtitulo">Esquemas, catálogo inicial y próximo código de cada serie, leídos de la base.</p>
      </div>
      <div class="acciones">
        <p-button icon="pi pi-refresh" label="Actualizar" [outlined]="true" [loading]="cargando()" (onClick)="cargar()" />
      </div>
    </header>

    <div class="nota nota-aviso nota-encabezado" *ngIf="error()">
      <i class="pi pi-exclamation-triangle"></i><span>{{ error() }}</span>
    </div>

    <ng-container *ngIf="estado() as e">
      <div class="tarjetas">
        <div class="tarjeta" *ngFor="let s of e.esquemas">
          <span class="rotulo">Esquema {{ s.esquema }}</span>
          <span class="valor">{{ s.tablas }}</span>
          <span class="secundario">tablas · {{ s.vistas }} vistas</span>
        </div>
        <div class="tarjeta" *ngFor="let c of catalogo(e)">
          <span class="rotulo">{{ c.rotulo }}</span>
          <span class="valor">{{ c.valor }}</span>
        </div>
      </div>

      <p-table [value]="e.series" styleClass="p-datatable-sm tabla">
        <ng-template pTemplate="header">
          <tr><th style="width: 8rem">Serie</th><th>Formato</th><th style="width: 10rem">Reinicio</th><th style="width: 16rem">Próximo código</th></tr>
        </ng-template>
        <ng-template pTemplate="body" let-s>
          <tr>
            <td><span class="codigo">{{ s.prefijo }}</span></td>
            <td><span class="codigo">{{ s.formato }}</span></td>
            <td>{{ s.reinicio | titlecase }}</td>
            <td><span class="codigo">{{ s.proximo_codigo }}</span></td>
          </tr>
        </ng-template>
      </p-table>
    </ng-container>
  `,
  styles: [ESTILOS_CARGAS, `
    .tarjetas { display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
    .tarjeta { display: flex; flex-direction: column; gap: 0.15rem; padding: 0.9rem 1rem; border-radius: 10px;
               background: var(--surface-card, #fff); border: 1px solid var(--surface-border, #e5e7eb); }
    .tarjeta .rotulo { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-color-secondary, #6b7280); }
    .tarjeta .valor { font-size: 1.5rem; font-weight: 650; font-variant-numeric: tabular-nums; }
  `],
})
export class EstadoCargasComponent implements OnInit {
  private readonly servicio = inject(CatalogosCargasService);

  readonly estado = signal<EstadoModulo | null>(null);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  private readonly rotulos: Record<string, string> = {
    elementos: 'Elementos', lineas: 'Líneas de producto', series: 'Series de lote',
    retenciones: 'Retenciones', conceptos_caja: 'Conceptos de caja',
  };

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.estado().subscribe({
      next: (e) => { this.estado.set(e); this.cargando.set(false); },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudo leer el estado del módulo. Revise que las migraciones de cargas se hayan ejecutado.');
      },
    });
  }

  catalogo(e: EstadoModulo): { rotulo: string; valor: number }[] {
    return Object.entries(e.catalogo).map(([clave, valor]) => ({ rotulo: this.rotulos[clave] ?? clave, valor }));
  }
}
