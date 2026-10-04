import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DocumentoService } from '../core/services/documento.service';
import {
  Documento, etiquetaEstadoDoc, etiquetaTipo, severidadEstadoDoc,
} from '../core/models/documento.model';
import { ESTILOS_CONFIG } from '../core/estilos/configuracion.estilos';

@Component({
  selector: 'app-documento-ficha',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, TableModule, ButtonModule,
    DialogModule, InputTextareaModule, TagModule, ToastModule,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <ng-container *ngIf="documento() as d">

      <header class="encabezado">
        <div>
          <button class="volver" type="button" routerLink="/activos/custodia">
            <i class="pi pi-arrow-left"></i> Custodia
          </button>
          <div class="titulo-fila">
            <span class="codigo grande">{{ d.numero }}</span>
            <p-tag [value]="etiquetaEstadoDoc(d.estado)" [severity]="severidadEstadoDoc(d.estado)" />
            <p-tag *ngIf="d.salida?.vencido" value="Retorno vencido" severity="warning" />
          </div>
          <p class="subtitulo">
            {{ etiquetaTipo(d.tipo) }} · {{ d.fecha | date: 'dd/MM/yyyy' }}
          </p>
        </div>

        <div class="acciones" *ngIf="d.estado === 'BORRADOR'">
          <p-button label="Confirmar" icon="pi pi-check" [loading]="procesando()"
                    (onClick)="confirmar()" />
        </div>

        <div class="acciones" *ngIf="d.estado === 'CONFIRMADO'">
          <p-button *ngIf="d.tipo === 'SALIDA_TEMPORAL' && !d.salida?.retorno_real"
                    label="Registrar retorno" icon="pi pi-reply" [outlined]="true"
                    [loading]="procesando()" (onClick)="registrarRetorno()" />
          <p-button label="Anular" icon="pi pi-times" severity="danger" [outlined]="true"
                    (onClick)="dialogAnular = true" />
        </div>
      </header>

      <!-- Aviso de estado: lo más importante de la pantalla -->
      <div class="nota" [ngClass]="claseNota(d)">
        <i class="pi" [ngClass]="iconoNota(d)"></i>
        <span [ngSwitch]="d.estado">
          <ng-container *ngSwitchCase="'BORRADOR'">
            <strong>Este documento aún no tiene efecto.</strong>
            Los bienes siguen como estaban. Al confirmarlo se aplicará el cambio
            y quedará registrado en la bitácora de cada uno.
          </ng-container>
          <ng-container *ngSwitchCase="'CONFIRMADO'">
            Aplicado el {{ d.trazabilidad.confirmado_at | date: 'dd/MM/yyyy HH:mm' }}.
            Anularlo revertirá a los bienes al estado exacto que tenían antes.
          </ng-container>
          <ng-container *ngSwitchCase="'ANULADO'">
            <strong>Anulado</strong> el {{ d.trazabilidad.anulado_at | date: 'dd/MM/yyyy HH:mm' }}.
            Motivo: {{ d.trazabilidad.motivo_anulacion }}.
            El efecto fue revertido y quedó un movimiento inverso en la bitácora.
          </ng-container>
        </span>
      </div>

      <div class="columnas">
        <!-- Datos -->
        <section class="bloque">
          <h3>Datos del documento</h3>
          <table class="datos">
            <tr><td>Tipo</td><td>{{ etiquetaTipo(d.tipo) }}</td></tr>
            <tr *ngIf="d.custodio_destino_id">
              <td>Custodio destino</td><td>#{{ d.custodio_destino_id }}</td>
            </tr>
            <tr *ngIf="d.salida">
              <td>Destino</td><td>{{ d.salida.destino }}</td>
            </tr>
            <tr *ngIf="d.salida">
              <td>Retorno comprometido</td>
              <td [class.vencido]="d.salida.vencido">
                {{ d.salida.retorno_comprometido | date: 'dd/MM/yyyy' }}
              </td>
            </tr>
            <tr *ngIf="d.salida?.retorno_real">
              <td>Retorno real</td>
              <td>{{ d.salida!.retorno_real | date: 'dd/MM/yyyy' }}</td>
            </tr>
            <tr *ngIf="d.motivo"><td>Motivo</td><td>{{ d.motivo }}</td></tr>
            <tr *ngIf="d.observaciones"><td>Observaciones</td><td>{{ d.observaciones }}</td></tr>
          </table>
        </section>

        <!-- Trazabilidad -->
        <section class="bloque">
          <h3>Trazabilidad</h3>
          <table class="datos">
            <tr>
              <td>Emitido</td>
              <td>{{ d.trazabilidad.creado_at | date: 'dd/MM/yyyy HH:mm' }}
                  <span class="secundario">· usuario #{{ d.trazabilidad.creado_por }}</span></td>
            </tr>
            <tr *ngIf="d.trazabilidad.confirmado_at">
              <td>Confirmado</td>
              <td>{{ d.trazabilidad.confirmado_at | date: 'dd/MM/yyyy HH:mm' }}
                  <span class="secundario">· usuario #{{ d.trazabilidad.confirmado_por }}</span></td>
            </tr>
            <tr *ngIf="d.trazabilidad.anulado_at">
              <td>Anulado</td>
              <td>{{ d.trazabilidad.anulado_at | date: 'dd/MM/yyyy HH:mm' }}
                  <span class="secundario">· usuario #{{ d.trazabilidad.anulado_por }}</span></td>
            </tr>
          </table>
        </section>
      </div>

      <section class="bloque">
        <h3>Bienes incluidos ({{ d.activos?.length ?? 0 }})</h3>

        <p-table [value]="d.activos ?? []" styleClass="p-datatable-sm tabla">
          <ng-template pTemplate="header">
            <tr>
              <th style="width: 13rem">Código</th>
              <th>Denominación</th>
              <th style="width: 10rem">Serie</th>
              <th style="width: 11rem">Estado al emitir</th>
              <th style="width: 4rem"></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-a>
            <tr>
              <td><span class="codigo">{{ a.codigo }}</span></td>
              <td>{{ a.denominacion }}</td>
              <td><span class="codigo">{{ a.serie || '—' }}</span></td>
              <td class="secundario">{{ a.estado_al_emitir }}</td>
              <td class="centro">
                <p-button icon="pi pi-arrow-right" [text]="true" [rounded]="true" size="small"
                          [routerLink]="['/activos/registro', a.id]" />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </section>

      <p-dialog [(visible)]="dialogAnular" header="Anular documento" [modal]="true"
                [style]="{ width: '30rem' }" [draggable]="false">
        <div class="nota nota-aviso mb-1">
          <i class="pi pi-exclamation-triangle"></i>
          <span>
            Los bienes volverán al estado exacto que tenían antes de confirmar este
            documento. El documento no se borra: queda anulado con su motivo.
          </span>
        </div>

        <label class="etiqueta-motivo" for="motivo">Motivo de la anulación</label>
        <textarea id="motivo" pInputTextarea [(ngModel)]="motivo" rows="3"
                  class="w-full" placeholder="Al menos 5 caracteres"></textarea>

        <ng-template pTemplate="footer">
          <p-button label="Cancelar" [text]="true" (onClick)="dialogAnular = false" />
          <p-button label="Anular" icon="pi pi-times" severity="danger"
                    [disabled]="motivo.trim().length < 5 || procesando()"
                    [loading]="procesando()" (onClick)="anular()" />
        </ng-template>
      </p-dialog>
    </ng-container>

    <div *ngIf="cargando()" class="vacio"><i class="pi pi-spin pi-spinner"></i></div>
  `,
  styles: [ESTILOS_CONFIG, `
    .volver {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0; margin-bottom: 0.5rem; font-size: 0.82rem;
      color: var(--text-color-secondary, #6b7280);
      background: none; border: none; cursor: pointer;
    }

    .titulo-fila { display: flex; align-items: center; gap: 0.6rem; }
    .codigo.grande { font-size: 1.35rem; }

    .nota { margin-bottom: 1.25rem; }
    .nota-ok { color: #166534; background: #f0fdf4; border-left-color: #16a34a; }
    .nota-mal { color: #991b1b; background: #fef2f2; border-left-color: #dc2626; }

    .columnas {
      display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem;
    }
    @media (max-width: 820px) { .columnas { grid-template-columns: 1fr; } }

    .bloque {
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #e5e7eb);
      border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.25rem;
    }

    .bloque h3 {
      margin: 0 0 1rem; font-size: 0.95rem; font-weight: 600;
    }

    .datos { width: 100%; font-size: 0.85rem; }
    .datos td { padding: 0.4rem 0; vertical-align: top; }
    .datos td:first-child {
      width: 42%; color: var(--text-color-secondary, #6b7280);
    }

    .vencido { color: #b45309; font-weight: 600; }

    .etiqueta-motivo {
      display: block; margin-bottom: 0.35rem;
      font-size: 0.8rem; font-weight: 550;
    }
    .w-full { width: 100%; }
    .mb-1 { margin-bottom: 1rem; }
  `],
})
export class DocumentoFichaComponent implements OnInit {
  private readonly servicio = inject(DocumentoService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly toast = inject(MessageService);

  readonly documento = signal<Documento | null>(null);
  readonly cargando = signal(true);
  readonly procesando = signal(false);

  readonly etiquetaTipo = etiquetaTipo;
  readonly etiquetaEstadoDoc = etiquetaEstadoDoc;
  readonly severidadEstadoDoc = severidadEstadoDoc;

  dialogAnular = false;
  motivo = '';

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    const id = Number(this.ruta.snapshot.paramMap.get('id'));

    this.servicio.ver(id).subscribe({
      next: (d) => { this.documento.set(d); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  claseNota(d: Documento): string {
    return d.estado === 'ANULADO' ? 'nota-mal'
      : d.estado === 'CONFIRMADO' ? 'nota-ok' : 'nota-aviso';
  }

  iconoNota(d: Documento): string {
    return d.estado === 'ANULADO' ? 'pi-times-circle'
      : d.estado === 'CONFIRMADO' ? 'pi-check-circle' : 'pi-info-circle';
  }

  confirmar(): void {
    const d = this.documento();
    if (!d) return;

    this.procesando.set(true);

    this.servicio.confirmar(d.id).subscribe({
      next: (r) => {
        this.procesando.set(false);
        this.documento.set(r.data);
        this.toast.add({ severity: 'success', summary: r.mensaje, life: 5000 });
      },
      error: (e) => {
        this.procesando.set(false);
        this.toast.add({
          severity: 'error', summary: 'No se pudo confirmar',
          detail: e?.error?.mensaje ?? 'Revise el estado de los bienes.',
          life: 8000,
        });
      },
    });
  }

  anular(): void {
    const d = this.documento();
    if (!d) return;

    this.procesando.set(true);

    this.servicio.anular(d.id, this.motivo).subscribe({
      next: (r) => {
        this.procesando.set(false);
        this.dialogAnular = false;
        this.motivo = '';
        this.documento.set(r.data);
        this.toast.add({ severity: 'info', summary: r.mensaje, life: 6000 });
      },
      error: (e) => {
        this.procesando.set(false);
        this.toast.add({
          severity: 'error', summary: 'No se pudo anular',
          detail: e?.error?.mensaje ?? '', life: 8000,
        });
      },
    });
  }

  registrarRetorno(): void {
    const d = this.documento();
    if (!d) return;

    this.procesando.set(true);

    this.servicio.registrarRetorno(d.id).subscribe({
      next: (r) => {
        this.procesando.set(false);
        this.documento.set(r.data);
        this.toast.add({ severity: 'success', summary: r.mensaje });
      },
      error: (e) => {
        this.procesando.set(false);
        this.toast.add({
          severity: 'error', summary: 'No se pudo registrar',
          detail: e?.error?.mensaje ?? '',
        });
      },
    });
  }
}
