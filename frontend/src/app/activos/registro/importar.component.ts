import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { environment } from '../../../environments/environment';
import { ESTILOS_CONFIG } from '../core/estilos/configuracion.estilos';

interface FilaValidada {
  numero: number;
  clase: string | null;
  subclase: string | null;
  denominacion: string | null;
  marca: string | null;
  serie: string | null;
  ubicacion: string | null;
  incorporacion: string | null;
  total: number;
  errores: string[];
  valida: boolean;
}

interface Resumen {
  total: number;
  validas: number;
  con_error: number;
  valor_total: number;
  importable: boolean;
}

@Component({
  selector: 'app-importar',
  standalone: true,
  imports: [CommonModule, ButtonModule, FileUploadModule, TableModule, TagModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <button class="volver" type="button" (click)="volver()">
          <i class="pi pi-arrow-left"></i> Activos fijos
        </button>
        <h2>Importar desde Excel</h2>
        <p class="subtitulo">
          Cada fila pasa por las mismas reglas que un alta manual: código correlativo,
          herencia de vida útil fiscal y registro en la bitácora.
        </p>
      </div>
      <div class="acciones">
        <p-button label="Descargar plantilla" icon="pi pi-download" [outlined]="true"
                  severity="secondary" (onClick)="descargarPlantilla()" />
      </div>
    </header>

    <!-- ----------------------------------------------------- Paso 1: archivo -->
    <section class="paso" [class.completo]="!!resumen()">
      <div class="paso-titulo">
        <span class="numero">1</span>
        <div>
          <h3>Seleccionar el archivo</h3>
          <p>
            Use la plantilla: trae los códigos de clases, subclases y ubicaciones
            vigentes en hojas aparte.
          </p>
        </div>
      </div>

      <div class="zona-carga" *ngIf="!archivo()">
        <input type="file" id="archivo" accept=".xlsx,.xls,.csv" hidden
               (change)="alElegirArchivo($event)" />
        <label for="archivo">
          <i class="pi pi-file-excel"></i>
          <span class="principal">Elegir archivo</span>
          <span class="secundario">xlsx, xls o csv · hasta 5 MB · máximo 2000 filas</span>
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

    <!-- -------------------------------------------------- Paso 2: validación -->
    <section class="paso" *ngIf="resumen() as r">
      <div class="paso-titulo">
        <span class="numero">2</span>
        <div>
          <h3>Revisar</h3>
          <p>
            Nada se ha guardado todavía. Si hay una sola fila con error,
            no se importa ninguna.
          </p>
        </div>
      </div>

      <div class="tarjetas">
        <div class="tarjeta">
          <span class="cifra">{{ r.total }}</span>
          <span class="rotulo">filas leídas</span>
        </div>
        <div class="tarjeta ok">
          <span class="cifra">{{ r.validas }}</span>
          <span class="rotulo">sin errores</span>
        </div>
        <div class="tarjeta" [class.mal]="r.con_error > 0">
          <span class="cifra">{{ r.con_error }}</span>
          <span class="rotulo">con errores</span>
        </div>
        <div class="tarjeta">
          <span class="cifra">{{ r.valor_total | number: '1.2-2' }}</span>
          <span class="rotulo">valor de origen</span>
        </div>
      </div>

      <div class="nota" [class.nota-aviso]="!r.importable" *ngIf="true">
        <i class="pi" [ngClass]="r.importable ? 'pi-check-circle' : 'pi-exclamation-triangle'"></i>
        <span *ngIf="r.importable">
          El archivo está listo. Al confirmar se registrarán {{ r.validas }} activo(s)
          en una sola operación.
        </span>
        <span *ngIf="!r.importable">
          Corrija las {{ r.con_error }} fila(s) marcadas y vuelva a validar. La importación
          es todo o nada: importar a medias dejaría códigos correlativos consumidos sin
          forma de saber qué entró.
        </span>
      </div>

      <p-table [value]="filas()" [paginator]="true" [rows]="15" styleClass="p-datatable-sm tabla">
        <ng-template pTemplate="header">
          <tr>
            <th style="width: 4rem" class="centro">Fila</th>
            <th style="width: 6rem">Clase</th>
            <th>Denominación</th>
            <th style="width: 10rem">Serie</th>
            <th style="width: 8rem">Ubicación</th>
            <th style="width: 9rem" class="derecha">Valor</th>
            <th style="width: 28rem">Resultado</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-f>
          <tr [class.fila-error]="!f.valida">
            <td class="centro numero">{{ f.numero }}</td>
            <td><span class="codigo">{{ f.clase }}-{{ f.subclase }}</span></td>
            <td>
              <div>{{ f.denominacion || '—' }}</div>
              <div class="secundario" *ngIf="f.marca">{{ f.marca }}</div>
            </td>
            <td><span class="codigo">{{ f.serie || '—' }}</span></td>
            <td><span class="codigo">{{ f.ubicacion || '—' }}</span></td>
            <td class="derecha numero">{{ f.total | number: '1.2-2' }}</td>
            <td>
              <p-tag *ngIf="f.valida" value="Correcta" severity="success" />
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
    .volver:hover { color: var(--primary-color, #3b82f6); }

    .paso {
      background: var(--surface-card, #fff);
      border: 1px solid var(--surface-border, #e5e7eb);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.25rem;
    }

    .paso-titulo {
      display: flex; gap: 0.85rem; align-items: flex-start;
      padding-bottom: 1.25rem; margin-bottom: 1.25rem;
      border-bottom: 1px solid var(--surface-border, #f1f3f5);
    }

    .numero {
      display: grid; place-items: center;
      width: 1.75rem; height: 1.75rem; flex-shrink: 0;
      font-size: 0.8rem; font-weight: 650;
      color: var(--primary-color, #3b82f6);
      background: var(--primary-50, #eff6ff);
      border-radius: 50%;
    }

    .paso-titulo h3 { margin: 0; font-size: 1rem; font-weight: 600; }
    .paso-titulo p {
      margin: 0.2rem 0 0; font-size: 0.82rem; line-height: 1.4;
      color: var(--text-color-secondary, #6b7280);
    }

    .zona-carga label {
      display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
      padding: 2.5rem 1rem;
      border: 2px dashed var(--surface-border, #d1d5db);
      border-radius: 10px; cursor: pointer;
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
      background: var(--surface-ground, #f9fafb);
      border-radius: 8px;
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
      background: var(--surface-ground, #f9fafb);
      border-radius: 8px;
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
      font-size: 0.72rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--text-color-secondary, #9ca3af);
    }

    .nota { margin-bottom: 1.25rem; }

    .fila-error { background: #fffbfb; }

    .errores { margin: 0; padding-left: 1rem; font-size: 0.78rem; color: #b91c1c; }
    .errores li { line-height: 1.4; }

    .acciones-pie {
      display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem;
    }

    .mt-1 { margin-top: 0.75rem; }
  `],
})
export class ImportarComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);
  private readonly base = `${environment.apiUrl}/activos/activos/importar`;

  readonly archivo = signal<File | null>(null);
  readonly filas = signal<FilaValidada[]>([]);
  readonly resumen = signal<Resumen | null>(null);
  readonly validando = signal(false);
  readonly importando = signal(false);

  alElegirArchivo(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];

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

  descargarPlantilla(): void {
    this.http.get(`${this.base}/plantilla`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla-activos.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.toast.add({ severity: 'error', summary: 'No se pudo generar la plantilla' }),
    });
  }

  validar(): void {
    const archivo = this.archivo();
    if (!archivo) return;

    this.validando.set(true);

    const datos = new FormData();
    datos.append('archivo', archivo);

    this.http.post<{ filas: FilaValidada[]; resumen: Resumen }>(`${this.base}/validar`, datos)
      .subscribe({
        next: (r) => {
          this.validando.set(false);
          this.filas.set(r.filas);
          this.resumen.set(r.resumen);
        },
        error: (e) => {
          this.validando.set(false);
          this.toast.add({
            severity: 'error',
            summary: 'No se pudo leer el archivo',
            detail: e?.error?.mensaje ?? 'Verifique el formato y los encabezados.',
            life: 8000,
          });
        },
      });
  }

  importar(): void {
    const archivo = this.archivo();
    if (!archivo) return;

    this.importando.set(true);

    const datos = new FormData();
    datos.append('archivo', archivo);

    this.http.post<{ data: { creados: number }; mensaje: string }>(this.base, datos).subscribe({
      next: (r) => {
        this.importando.set(false);
        this.toast.add({
          severity: 'success',
          summary: 'Importación completada',
          detail: r.mensaje,
          life: 6000,
        });
        setTimeout(() => this.router.navigate(['/activos/registro']), 1200);
      },
      error: (e) => {
        this.importando.set(false);
        this.toast.add({
          severity: 'error',
          summary: 'No se importó',
          detail: e?.error?.mensaje ?? 'Revise el archivo.',
          life: 8000,
        });
      },
    });
  }

  volver(): void {
    this.router.navigate(['/activos/registro']);
  }
}
