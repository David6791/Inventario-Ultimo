import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { OrganizacionService } from '../core/services/organizacion.service';
import { FilaPersonal, ResumenImportacion } from '../core/models/organizacion.model';
import { ESTILOS_CONFIG } from '../core/estilos/configuracion.estilos';

@Component({
  selector: 'app-importar-personal',
  standalone: true,
  imports: [CommonModule, ButtonModule, TableModule, TagModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <button class="volver" type="button" (click)="volver()">
          <i class="pi pi-arrow-left"></i> Personal
        </button>
        <h2>Importar personal</h2>
        <p class="subtitulo">
          Acepta el formato de importación de planilla. Se toman solo los datos
          necesarios para la custodia.
        </p>
      </div>
      <div class="acciones">
        <p-button label="Descargar plantilla" icon="pi pi-download"
                  [outlined]="true" severity="secondary"
                  (onClick)="descargarPlantilla()" />
      </div>
    </header>

    <div class="nota nota-encabezado">
      <i class="pi pi-shield"></i>
      <span>
        <strong>No se importan datos salariales.</strong> El formato trae Haber Básico,
        AFP, NUA y Tipo de Planilla; nada de eso entra. Un módulo de activos no necesita
        sueldos, y guardarlos crearía una obligación de resguardo que no le corresponde.
      </span>
    </div>

    <!-- ------------------------------------------------------- Paso 1 -->
    <section class="paso">
      <div class="paso-titulo">
        <span class="numero">1</span>
        <div>
          <h3>Seleccionar el archivo</h3>
          <p>Las columnas se ubican por su encabezado, así que el orden no importa.</p>
        </div>
      </div>

      <div class="zona-carga" *ngIf="!archivo()">
        <input type="file" id="archivo" accept=".xlsx,.xls,.csv" hidden
               (change)="alElegir($event)" />
        <label for="archivo">
          <i class="pi pi-file-excel"></i>
          <span class="principal">Elegir archivo</span>
          <span class="secundario">xlsx, xls o csv · hasta 5 MB</span>
        </label>
      </div>

      <div class="archivo-elegido" *ngIf="archivo() as a">
        <i class="pi pi-file-excel"></i>
        <div class="datos">
          <div class="nombre">{{ a.name }}</div>
          <div class="secundario">{{ (a.size / 1024) | number: '1.0-0' }} KB</div>
        </div>
        <p-button icon="pi pi-times" [text]="true" [rounded]="true" severity="secondary"
                  (onClick)="limpiar()" />
      </div>

      <p-button *ngIf="archivo() && !resumen()" label="Validar archivo" icon="pi pi-check-circle"
                [loading]="validando()" (onClick)="validar()" styleClass="mt-1" />
    </section>

    <!-- ------------------------------------------------------- Paso 2 -->
    <section class="paso" *ngIf="resumen() as r">
      <div class="paso-titulo">
        <span class="numero">2</span>
        <div>
          <h3>Revisar</h3>
          <p>Nada se ha guardado. Si hay una fila con error, no se importa ninguna.</p>
        </div>
      </div>

      <div class="tarjetas">
        <div class="tarjeta">
          <span class="cifra">{{ r.total }}</span>
          <span class="rotulo">filas leídas</span>
        </div>
        <div class="tarjeta ok">
          <span class="cifra">{{ r.nuevos }}</span>
          <span class="rotulo">personas nuevas</span>
        </div>
        <div class="tarjeta">
          <span class="cifra">{{ r.existentes }}</span>
          <span class="rotulo">se actualizarán</span>
        </div>
        <div class="tarjeta" [class.mal]="r.con_error > 0">
          <span class="cifra">{{ r.con_error }}</span>
          <span class="rotulo">con errores</span>
        </div>
      </div>

      <div class="nota" [class.nota-aviso]="!r.importable">
        <i class="pi" [ngClass]="r.importable ? 'pi-check-circle' : 'pi-exclamation-triangle'"></i>
        <span *ngIf="r.importable">
          Listo. Se detectaron las áreas <strong>{{ r.areas.join(', ') }}</strong> y los centros
          <strong>{{ r.centros.join(', ') }}</strong>. Los que no existan se crearán,
          y después hay que asignarles almacén para que sus activos sean visibles.
        </span>
        <span *ngIf="!r.importable">
          Corrija las {{ r.con_error }} fila(s) marcadas y vuelva a validar.
        </span>
      </div>

      <p-table [value]="filas()" [paginator]="true" [rows]="15" styleClass="p-datatable-sm tabla">
        <ng-template pTemplate="header">
          <tr>
            <th style="width: 4rem" class="centro">Fila</th>
            <th style="width: 8rem">Código</th>
            <th>Nombre</th>
            <th style="width: 9rem">C.I.</th>
            <th style="width: 12rem">Centro</th>
            <th style="width: 24rem">Resultado</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-f>
          <tr [class.fila-error]="!f.valida">
            <td class="centro numero">{{ f.numero }}</td>
            <td><span class="codigo">{{ f.codigo || '—' }}</span></td>
            <td>{{ f.apellido_paterno }} {{ f.apellido_materno }} {{ f.nombres }}</td>
            <td><span class="codigo">{{ f.ci || '—' }}</span></td>
            <td class="secundario">{{ f.centro_costo }}</td>
            <td>
              <p-tag *ngIf="f.valida && !f.existe" value="Nueva" severity="success" />
              <p-tag *ngIf="f.valida && f.existe" value="Actualiza" severity="info" />
              <ul class="errores" *ngIf="!f.valida">
                <li *ngFor="let e of f.errores">{{ e }}</li>
              </ul>
            </td>
          </tr>
        </ng-template>
      </p-table>

      <div class="acciones-pie">
        <p-button label="Elegir otro archivo" [text]="true" (onClick)="limpiar()" />
        <p-button label="Confirmar importación" icon="pi pi-upload"
                  [disabled]="!r.importable || importando()" [loading]="importando()"
                  (onClick)="importar()" />
      </div>
    </section>
  `,
  styles: [ESTILOS_CONFIG, `
    .volver {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0; margin-bottom: 0.5rem; font-size: 0.82rem;
      color: var(--text-color-secondary, #6b7280);
      background: none; border: none; cursor: pointer;
    }

    .paso {
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #e5e7eb);
      border-radius: 12px; padding: 1.5rem; margin-bottom: 1.25rem;
    }

    .paso-titulo {
      display: flex; gap: 0.85rem; align-items: flex-start;
      padding-bottom: 1.25rem; margin-bottom: 1.25rem;
      border-bottom: 1px solid var(--surface-border, #f1f3f5);
    }

    .numero {
      display: grid; place-items: center; width: 1.75rem; height: 1.75rem;
      flex-shrink: 0; font-size: 0.8rem; font-weight: 650;
      color: var(--primary-color, #3b82f6); background: var(--primary-50, #eff6ff);
      border-radius: 50%;
    }

    .paso-titulo h3 { margin: 0; font-size: 1rem; font-weight: 600; }
    .paso-titulo p {
      margin: 0.2rem 0 0; font-size: 0.82rem;
      color: var(--text-color-secondary, #6b7280);
    }

    .zona-carga label {
      display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
      padding: 2.5rem 1rem; cursor: pointer;
      border: 2px dashed var(--surface-border, #d1d5db); border-radius: 10px;
    }
    .zona-carga label:hover {
      border-color: var(--primary-color, #3b82f6);
      background: var(--primary-50, #f8fbff);
    }
    .zona-carga i { font-size: 2rem; color: #16a34a; }
    .zona-carga .principal { font-weight: 600; }

    .archivo-elegido {
      display: flex; align-items: center; gap: 0.85rem;
      padding: 0.9rem 1rem; margin-bottom: 1rem;
      background: var(--surface-ground, #f9fafb); border-radius: 8px;
    }
    .archivo-elegido i { font-size: 1.5rem; color: #16a34a; }
    .archivo-elegido .datos { flex: 1; }
    .archivo-elegido .nombre { font-weight: 550; }

    .tarjetas {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem;
      margin-bottom: 1.25rem;
    }
    @media (max-width: 720px) { .tarjetas { grid-template-columns: repeat(2, 1fr); } }

    .tarjeta {
      display: flex; flex-direction: column; gap: 0.15rem;
      padding: 0.9rem 1rem;
      background: var(--surface-ground, #f9fafb); border-radius: 8px;
    }
    .tarjeta.ok { background: #f0fdf4; }
    .tarjeta.mal { background: #fef2f2; }

    .cifra {
      font-size: 1.5rem; font-weight: 650;
      font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
    }
    .tarjeta.ok .cifra { color: #16a34a; }
    .tarjeta.mal .cifra { color: #dc2626; }

    .rotulo {
      font-size: 0.72rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.04em; color: var(--text-color-secondary, #9ca3af);
    }

    .nota { margin-bottom: 1.25rem; }
    .fila-error { background: #fffbfb; }

    .errores { margin: 0; padding-left: 1rem; font-size: 0.78rem; color: #b91c1c; }

    .acciones-pie {
      display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem;
    }

    .mt-1 { margin-top: 0.75rem; }
  `],
})
export class ImportarPersonalComponent {
  private readonly servicio = inject(OrganizacionService);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);

  readonly archivo = signal<File | null>(null);
  readonly filas = signal<FilaPersonal[]>([]);
  readonly resumen = signal<ResumenImportacion | null>(null);
  readonly validando = signal(false);
  readonly importando = signal(false);

  alElegir(evento: Event): void {
    const archivo = (evento.target as HTMLInputElement).files?.[0];

    if (archivo) {
      this.archivo.set(archivo);
      this.resumen.set(null);
      this.filas.set([]);
    }
  }

  limpiar(): void {
    this.archivo.set(null);
    this.resumen.set(null);
    this.filas.set([]);
  }

  validar(): void {
    const a = this.archivo();
    if (!a) return;

    this.validando.set(true);

    this.servicio.validarImportacion(a).subscribe({
      next: (r) => {
        this.validando.set(false);
        this.filas.set(r.filas);
        this.resumen.set(r.resumen);
      },
      error: (e) => {
        this.validando.set(false);
        this.toast.add({
          severity: 'error', summary: 'No se pudo leer el archivo',
          detail: e?.error?.mensaje ?? 'Verifique el formato.',
          life: 9000,
        });
      },
    });
  }

  importar(): void {
    const a = this.archivo();
    if (!a) return;

    this.importando.set(true);

    this.servicio.importar(a).subscribe({
      next: (r) => {
        this.importando.set(false);
        this.toast.add({
          severity: 'success', summary: 'Importación completada',
          detail: r.mensaje, life: 10000,
        });
        setTimeout(() => this.router.navigate(['/activos/organizacion/centros']), 1500);
      },
      error: (e) => {
        this.importando.set(false);
        this.toast.add({
          severity: 'error', summary: 'No se importó',
          detail: e?.error?.mensaje ?? '', life: 9000,
        });
      },
    });
  }

  volver(): void {
    this.router.navigate(['/activos/organizacion/personal']);
  }
    descargarPlantilla(): void {
    this.servicio.descargarPlantilla().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla-personal.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.toast.add({
        severity: 'error', summary: 'No se pudo generar la plantilla',
      }),
    });
  }
}
