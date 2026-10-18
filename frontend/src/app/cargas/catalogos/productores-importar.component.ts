import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { mensajeDeError } from '../core/errores';
import { ESTILOS_CARGAS } from '../core/estilos';
import { RevisionProductores } from '../core/models/cargas.model';
import { CatalogosCargasService } from '../core/services/catalogos-cargas.service';

/**
 * Carga masiva de productores y sus cooperativas, en tres pasos: descargar la
 * plantilla, revisar el archivo (no escribe nada) y confirmar (todo o nada).
 */
@Component({
  selector: 'app-productores-importar',
  standalone: true,
  imports: [CommonModule, RouterLink, TableModule, ButtonModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />

    <header class="encabezado">
      <div>
        <h2>Importar productores</h2>
        <p class="subtitulo">
          Cargue los productores del sistema anterior o de una planilla. Las cooperativas que
          no existan se crean; las escritas de varias formas se unifican.
        </p>
      </div>
      <div class="acciones">
        <p-button label="Volver" [text]="true" severity="secondary" routerLink="/cargas/productores" />
      </div>
    </header>

    <section class="paso">
      <div class="numero">1</div>
      <div class="contenido">
        <h3>Descargue la plantilla</h3>
        <p>Trae una hoja de instrucciones y la lista de cooperativas ya registradas, para
           escribirlas igual y no duplicarlas.</p>
        <p-button icon="pi pi-download" label="Descargar plantilla" [outlined]="true"
                  [loading]="bajando()" (onClick)="descargar()" />
      </div>
    </section>

    <section class="paso">
      <div class="numero">2</div>
      <div class="contenido">
        <h3>Llénela y súbala</h3>
        <p>Una fila por productor. Un CI o NIT que ya existe actualiza a ese productor.</p>

        <div class="zona-archivo">
          <ng-container *ngIf="archivo() as a; else elegirArchivo">
            <i class="pi pi-file-excel"></i>
            <div class="datos">
              <span class="nombre">{{ a.name }}</span>
              <span class="secundario">{{ (a.size / 1024).toFixed(0) }} kB</span>
            </div>
            <p-button icon="pi pi-times" [text]="true" [rounded]="true" severity="danger" (onClick)="limpiar()" />
          </ng-container>
          <ng-template #elegirArchivo>
            <i class="pi pi-cloud-upload"></i>
            <div class="datos">
              <span class="nombre">Elija el archivo llenado</span>
              <span class="secundario">Formato .xlsx o .xls, hasta 5 MB</span>
            </div>
            <input type="file" accept=".xlsx,.xls" (change)="elegir($event)" />
          </ng-template>
        </div>

        <p-button *ngIf="archivo() && !revision()" icon="pi pi-search" label="Revisar archivo"
                  [loading]="revisando()" (onClick)="revisar()" />
      </div>
    </section>

    <section class="paso" *ngIf="revision() as r">
      <div class="numero" [class.con-error]="r.errores.length">3</div>
      <div class="contenido">
        <ng-container *ngIf="r.errores.length; else correcto">
          <h3>Hay {{ r.errores.length }} problema(s) que corregir</h3>
          <div class="nota nota-aviso nota-encabezado">
            <i class="pi pi-exclamation-triangle"></i>
            <span><strong>No se importó nada.</strong> Corrija el archivo y vuelva a subirlo.</span>
          </div>
          <p-table [value]="r.errores" styleClass="p-datatable-sm tabla" [scrollable]="true" scrollHeight="22rem">
            <ng-template pTemplate="header">
              <tr><th style="width: 5rem">Fila</th><th style="width: 9rem">Columna</th><th>Qué corregir</th></tr>
            </ng-template>
            <ng-template pTemplate="body" let-e>
              <tr><td class="numero-fila">{{ e.fila }}</td><td>{{ e.columna }}</td><td>{{ e.mensaje }}</td></tr>
            </ng-template>
          </p-table>
        </ng-container>

        <ng-template #correcto>
          <h3>El archivo está correcto</h3>
          <p>
            Se registrarán <strong>{{ r.nuevos }}</strong> productor(es) nuevo(s)
            <span *ngIf="r.actualizados"> y se actualizarán <strong>{{ r.actualizados }}</strong> existente(s)</span>.
          </p>

          <div class="nota nota-encabezado" *ngIf="r.cooperativas_nuevas.length">
            <i class="pi pi-plus-circle"></i>
            <span>Se crearán {{ r.cooperativas_nuevas.length }} cooperativa(s): {{ r.cooperativas_nuevas.join(', ') }}.</span>
          </div>

          <div class="nota nota-neutra nota-encabezado" *ngIf="r.cooperativas_unificadas.length">
            <i class="pi pi-link"></i>
            <span>
              Nombres unificados:
              <ng-container *ngFor="let u of r.cooperativas_unificadas; let ultimo = last">
                «{{ u.variantes.join('», «') }}» → <strong>{{ u.nombre }}</strong><span *ngIf="!ultimo">; </span>
              </ng-container>
            </span>
          </div>

          <div class="nota nota-aviso nota-encabezado" *ngIf="r.advertencias.length">
            <i class="pi pi-info-circle"></i>
            <span>
              {{ r.advertencias.length }} posible(s) duplicado(s) por nombre, no bloquean la carga:
              <span *ngFor="let a of r.advertencias.slice(0, 5)"><br />Fila {{ a.fila }}: {{ a.mensaje }}</span>
            </span>
          </div>

          <p class="secundario" *ngIf="r.muestra.length">Primeras {{ r.muestra.length }} filas, para comprobar que las columnas se leyeron bien:</p>
          <p-table [value]="r.muestra" styleClass="p-datatable-sm tabla" *ngIf="r.muestra.length">
            <ng-template pTemplate="header">
              <tr><th style="width: 5rem">Fila</th><th>Nombre</th><th style="width: 9rem">Documento</th>
                  <th style="width: 10rem">Tipo</th><th style="width: 14rem">Cooperativa</th><th style="width: 7rem">Acción</th></tr>
            </ng-template>
            <ng-template pTemplate="body" let-m>
              <tr>
                <td class="numero-fila">{{ m.fila }}</td>
                <td>{{ m.nombre }}</td>
                <td><span class="codigo">{{ m.documento }}</span></td>
                <td>{{ m.tipo }}</td>
                <td>{{ m.cooperativa ?? '—' }}</td>
                <td><span class="pastilla" [class.pastilla-aviso]="m.accion === 'actualiza'">
                  {{ m.accion === 'actualiza' ? 'Actualiza' : 'Nuevo' }}</span></td>
              </tr>
            </ng-template>
          </p-table>

          <div class="confirmar">
            <p-button icon="pi pi-check" label="Confirmar importación" [loading]="importando()" (onClick)="importar()" />
            <p-button label="Elegir otro archivo" [text]="true" severity="secondary" (onClick)="limpiar()" />
          </div>
        </ng-template>
      </div>
    </section>
  `,
  styles: [ESTILOS_CARGAS, `
    .paso { display: flex; gap: 1.25rem; padding: 1.25rem 0; border-bottom: 1px solid var(--surface-border, #e5e7eb); }
    .paso:last-of-type { border-bottom: 0; }
    .numero { flex: none; width: 2rem; height: 2rem; border-radius: 50%; display: flex; align-items: center;
              justify-content: center; font-weight: 600; font-size: 0.85rem; background: #e0f2fe; color: #075985; }
    .numero.con-error { background: #fee2e2; color: #b91c1c; }
    .contenido { flex: 1; min-width: 0; }
    .contenido h3 { margin: 0 0 0.3rem; font-size: 1rem; font-weight: 600; }
    .contenido > p { margin: 0 0 0.9rem; font-size: 0.85rem; color: var(--text-color-secondary, #6b7280); max-width: 70ch; }
    .zona-archivo { position: relative; display: flex; align-items: center; gap: 0.9rem; padding: 1rem;
                    margin-bottom: 0.9rem; border: 1px dashed var(--surface-border, #d1d5db); border-radius: 8px; }
    .zona-archivo i { font-size: 1.6rem; color: var(--text-color-secondary, #6b7280); }
    .zona-archivo .datos { display: flex; flex-direction: column; flex: 1; }
    .zona-archivo .nombre { font-weight: 550; }
    .zona-archivo input[type=file] { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .numero-fila { font-variant-numeric: tabular-nums; color: var(--text-color-secondary, #6b7280); }
    .confirmar { display: flex; gap: 0.5rem; margin-top: 1rem; }
  `],
})
export class ProductoresImportarComponent {
  private readonly servicio = inject(CatalogosCargasService);
  private readonly toast = inject(MessageService);
  private readonly router = inject(Router);

  readonly archivo = signal<File | null>(null);
  readonly revision = signal<RevisionProductores | null>(null);
  readonly bajando = signal(false);
  readonly revisando = signal(false);
  readonly importando = signal(false);

  descargar(): void {
    this.bajando.set(true);
    this.servicio.plantillaProductores().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = 'plantilla-productores.xlsx';
        enlace.click();
        URL.revokeObjectURL(url);
        this.bajando.set(false);
      },
      error: () => {
        this.bajando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo descargar la plantilla' });
      },
    });
  }

  elegir(evento: Event): void {
    const archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;
    this.archivo.set(archivo);
    this.revision.set(null);
  }

  limpiar(): void {
    this.archivo.set(null);
    this.revision.set(null);
  }

  revisar(): void {
    const archivo = this.archivo();
    if (!archivo) return;

    this.revisando.set(true);
    this.servicio.revisarProductores(archivo).subscribe({
      next: (r) => { this.revision.set(r); this.revisando.set(false); },
      error: (e) => {
        this.revisando.set(false);
        this.toast.add({ severity: 'error', summary: 'No se pudo revisar', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }

  importar(): void {
    const archivo = this.archivo();
    if (!archivo) return;

    this.importando.set(true);
    this.servicio.importarProductores(archivo).subscribe({
      next: (r) => {
        this.importando.set(false);
        this.toast.add({ severity: 'success', summary: 'Importación terminada', detail: r.mensaje, life: 6000 });
        setTimeout(() => this.router.navigate(['/cargas/productores']), 1500);
      },
      error: (e: HttpErrorResponse) => {
        this.importando.set(false);
        // Entre revisar e importar alguien pudo registrar un productor con el mismo CI.
        if (e.status === 422 && e.error?.errores) {
          this.revision.set(e.error as RevisionProductores);
        }
        this.toast.add({ severity: 'error', summary: 'No se importó', detail: mensajeDeError(e), life: 8000 });
      },
    });
  }
}
