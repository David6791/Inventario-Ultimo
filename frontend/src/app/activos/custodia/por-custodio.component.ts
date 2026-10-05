import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { environment } from '../../../environments/environment';
import { DocumentoService } from '../core/services/documento.service';
import { BienDeCustodio } from '../core/models/documento.model';
import { ESTILOS_CONFIG } from '../core/estilos/configuracion.estilos';

//interface Usuario { id: number; name: string; cargo?: string | null; }
interface Usuario { id: number; nombre: string; ci?: string | null; cargo?: string | null; }
/**
 * Bienes a cargo de una persona.
 *
 * Es la pantalla que sostiene el descargo laboral: antes de un finiquito hay
 * que verificar físicamente todo lo que figura acá. Por eso es imprimible.
 */
@Component({
  selector: 'app-por-custodio',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, TableModule, ButtonModule,
    DropdownModule, TagModule, ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado no-imprimir">
      <div>
        <h2>Bienes por custodio</h2>
        <p class="subtitulo">
          Lo que una persona tiene a su cargo. Es la base de la constancia de
          descargo: sin verificación física no se procesa un finiquito.
        </p>
      </div>
      <div class="acciones">
        <p-button label="Imprimir" icon="pi pi-print" [outlined]="true"
                  [disabled]="!bienes().length" (onClick)="imprimir()" />
      </div>
    </header>

    <div class="barra no-imprimir">
      <div class="filtro ancho">
        <p-dropdown [options]="usuarios()" optionLabel="name" optionValue="id"
                    placeholder="Elija un custodio" [filter]="true" filterBy="name"
                    appendTo="body" [(ngModel)]="custodioId" (onChange)="cargar()" />
      </div>
    </div>

    <ng-container *ngIf="custodioId">
      <div class="cabecera-impresion">
        <h3>Detalle de bienes a cargo</h3>
        <div class="datos-persona">
          <span><strong>Custodio:</strong> {{ nombreCustodio() }}</span>
          <span><strong>Fecha:</strong> {{ hoy | date: 'dd/MM/yyyy' }}</span>
        </div>
      </div>

      <div class="tarjetas no-imprimir" *ngIf="bienes().length">
        <div class="tarjeta">
          <span class="cifra">{{ resumen().cantidad }}</span>
          <span class="rotulo">bienes a cargo</span>
        </div>
        <div class="tarjeta">
          <span class="cifra">{{ resumen().valor | number: '1.2-2' }}</span>
          <span class="rotulo">valor de origen</span>
        </div>
      </div>

      <p-table [value]="bienes()" [loading]="cargando()" styleClass="p-datatable-sm tabla">
        <ng-template pTemplate="header">
          <tr>
            <th style="width: 13rem">Código</th>
            <th>Denominación</th>
            <th style="width: 10rem">Serie</th>
            <th style="width: 12rem">Ubicación</th>
            <th style="width: 8rem" class="centro">Condición</th>
            <th style="width: 9rem" class="derecha">Valor</th>
            <th style="width: 4rem" class="no-imprimir"></th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-b>
          <tr>
            <td><span class="codigo">{{ b.codigo }}</span></td>
            <td>{{ b.denominacion }}</td>
            <td><span class="codigo">{{ b.serie || '—' }}</span></td>
            <td class="secundario">{{ b.ubicacion || '—' }}</td>
            <td class="centro">{{ b.condicion }}</td>
            <td class="derecha numero">{{ b.valor_origen | number: '1.2-2' }}</td>
            <td class="centro no-imprimir">
              <p-button icon="pi pi-arrow-right" [text]="true" [rounded]="true" size="small"
                        [routerLink]="['/activos/registro', b.id]" />
            </td>
          </tr>
        </ng-template>

        <ng-template pTemplate="footer">
          <tr *ngIf="bienes().length">
            <td colspan="5" class="derecha"><strong>Total</strong></td>
            <td class="derecha numero"><strong>{{ resumen().valor | number: '1.2-2' }}</strong></td>
            <td class="no-imprimir"></td>
          </tr>
        </ng-template>

        <ng-template pTemplate="emptymessage">
          <tr><td colspan="7">
            <div class="vacio">
              <i class="pi pi-check-circle"></i>
              <p class="titulo-vacio">Esta persona no tiene bienes a su cargo</p>
            </div>
          </td></tr>
        </ng-template>
      </p-table>

      <div class="firmas" *ngIf="bienes().length">
        <div class="firma">
          <div class="linea"></div>
          <span>{{ nombreCustodio() }}</span>
          <small>Custodio</small>
        </div>
        <div class="firma">
          <div class="linea"></div>
          <span>Responsable de Activos Fijos</span>
          <small>Verificación física</small>
        </div>
      </div>
    </ng-container>
  `,
  styles: [ESTILOS_CONFIG, `
    .filtro.ancho { flex: 1 1 24rem; }

    .cabecera-impresion { display: none; }

    .tarjetas {
      display: grid; grid-template-columns: repeat(2, minmax(0, 16rem));
      gap: 0.75rem; margin-bottom: 1.25rem;
    }
    .tarjeta {
      display: flex; flex-direction: column; gap: 0.15rem;
      padding: 0.9rem 1rem;
      background: var(--surface-ground, #f9fafb); border-radius: 8px;
    }
    .cifra {
      font-size: 1.5rem; font-weight: 650;
      font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
    }
    .rotulo {
      font-size: 0.72rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--text-color-secondary, #9ca3af);
    }

    .firmas {
      display: grid; grid-template-columns: 1fr 1fr; gap: 4rem;
      margin-top: 4rem; padding: 0 2rem;
    }
    .firma { text-align: center; }
    .firma .linea { border-top: 1px solid #333; margin-bottom: 0.4rem; }
    .firma span { display: block; font-size: 0.85rem; font-weight: 550; }
    .firma small { font-size: 0.75rem; color: var(--text-color-secondary, #6b7280); }

    @media print {
      .no-imprimir { display: none !important; }
      :host { padding: 0; }
      .cabecera-impresion { display: block; margin-bottom: 1.5rem; }
      .cabecera-impresion h3 { margin: 0 0 0.75rem; font-size: 1.1rem; }
      .datos-persona { display: flex; gap: 2rem; font-size: 0.85rem; }
      @page { size: A4; margin: 15mm; }
    }
  `],
})
export class PorCustodioComponent implements OnInit {
  private readonly servicio = inject(DocumentoService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(MessageService);

  readonly usuarios = signal<Usuario[]>([]);
  readonly bienes = signal<BienDeCustodio[]>([]);
  readonly resumen = signal<{ cantidad: number; valor: number }>({ cantidad: 0, valor: 0 });
  readonly cargando = signal(false);

  readonly hoy = new Date();

  custodioId: number | null = null;

  ngOnInit(): void {
    this.http.get<{ data: Usuario[] }>(`${environment.apiUrl}/activos/custodios`)
      .subscribe({
        next: (r) => this.usuarios.set(r.data ?? []),
        error: () => this.toast.add({
          severity: 'warn', summary: 'No se pudo cargar la lista de custodios',
        }),
      });
  }

    nombreCustodio(): string {
    return this.usuarios().find((u) => u.id === this.custodioId)?.nombre ?? '';
  }

  cargar(): void {
    if (!this.custodioId) return;

    this.cargando.set(true);

    this.servicio.porCustodio(this.custodioId).subscribe({
      next: (r) => {
        this.bienes.set(r.data);
        this.resumen.set(r.resumen);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  imprimir(): void {
    window.print();
  }
}
