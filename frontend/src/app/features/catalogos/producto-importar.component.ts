import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import {
  ErrorImportacion, RevisionImportacion,
} from '../../core/models/importacion.models';
import { ImportacionService } from '../../core/services/importacion.service';

/**
 * Carga masiva de productos.
 *
 * Tres pasos a la vista: descargar la plantilla, revisar el archivo, confirmar.
 * La revisión no escribe nada — nadie debería descubrir lo que cargó después
 * de cargarlo.
 */
@Component({
  selector: 'app-producto-importar',
  standalone: true,
  imports: [RouterLink, TableModule, ButtonModule, TooltipModule],
  template: `
    <header class="pagina">
      <div>
        <h1>Importar productos</h1>
        <p>Cargue muchos productos de una vez desde una planilla de Excel.</p>
      </div>
      <div class="acciones">
        <button pButton label="Volver" severity="secondary" text
                routerLink="/productos"></button>
      </div>
    </header>

    <!-- Paso 1 -->
    <section class="paso">
      <div class="numero">1</div>
      <div class="contenido">
        <h2>Descargue la plantilla</h2>
        <p>Trae las categorías y unidades que existen ahora en el sistema, con
           listas desplegables para elegirlas sin equivocarse. Incluye una hoja
           de instrucciones.</p>
        <button pButton icon="pi pi-download" label="Descargar plantilla" outlined
                [loading]="bajando()" (click)="descargar()"></button>
      </div>
    </section>

    <!-- Paso 2 -->
    <section class="paso">
      <div class="numero">2</div>
      <div class="contenido">
        <h2>Llénela y súbala</h2>
        <p>Una fila por producto. Borre las dos filas de ejemplo antes de
           guardar.</p>

        <div class="zona-archivo" [class.con-archivo]="archivo()">
          @if (archivo(); as a) {
            <i class="pi pi-file-excel"></i>
            <div class="datos">
              <span class="nombre">{{ a.name }}</span>
              <span class="peso">{{ (a.size / 1024).toFixed(0) }} kB</span>
            </div>
            <button pButton icon="pi pi-times" text rounded severity="danger"
                    pTooltip="Quitar" (click)="limpiar()"></button>
          } @else {
            <i class="pi pi-cloud-upload"></i>
            <div class="datos">
              <span class="nombre">Elija el archivo llenado</span>
              <span class="peso">Formato .xlsx o .xls, hasta 5 MB</span>
            </div>
            <input type="file" accept=".xlsx,.xls" (change)="elegir($event)" />
          }
        </div>

        @if (errorArchivo()) {
          <small class="error-archivo">{{ errorArchivo() }}</small>
        }

        @if (archivo() && !revision()) {
          <button pButton icon="pi pi-search" label="Revisar archivo"
                  [loading]="revisando()" (click)="revisar()"></button>
        }
      </div>
    </section>

    <!-- Paso 3 -->
    @if (revision(); as r) {
      <section class="paso">
        <div class="numero" [class.con-error]="r.errores.length">3</div>
        <div class="contenido">

          @if (r.errores.length) {
            <h2>Hay {{ r.errores.length }} problema(s) que corregir</h2>
            <p class="advertencia">
              <strong>No se importó nada.</strong> Corrija el archivo en Excel y
              vuelva a subirlo. Se revisa todo antes de cargar para que el
              catálogo no quede a medias.
            </p>

            <p-table [value]="r.errores" styleClass="p-datatable-sm" [scrollable]="true"
                     scrollHeight="20rem">
              <ng-template pTemplate="header">
                <tr>
                  <th style="width:6rem">Fila</th>
                  <th style="width:12rem">Columna</th>
                  <th>Qué corregir</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-e>
                <tr class="marca marca-agotado">
                  <td class="cifra">{{ e.fila || '—' }}</td>
                  <td class="tenue">{{ e.columna || '—' }}</td>
                  <td>{{ e.mensaje }}</td>
                </tr>
              </ng-template>
            </p-table>

          } @else {
            <h2>El archivo está correcto</h2>
            <p>
              Se van a registrar <strong>{{ r.nuevos }}</strong> producto(s) nuevo(s)
              @if (r.actualizados) {
                y actualizar <strong>{{ r.actualizados }}</strong> existente(s)
              }
              .
            </p>

            @if (r.actualizados) {
              <p class="advertencia">
                Los códigos que ya existen se actualizan con los datos del
                archivo. Revise la vista previa antes de confirmar.
              </p>
            }

            @if (r.muestra.length) {
              <p class="rotulo-muestra">
                Primeras {{ r.muestra.length }} filas, para verificar que las
                columnas se leyeron donde corresponde:
              </p>

              <p-table [value]="r.muestra" styleClass="p-datatable-sm">
                <ng-template pTemplate="header">
                  <tr>
                    <th style="width:5rem">Fila</th>
                    <th style="width:11rem">Código</th>
                    <th>Nombre</th>
                    <th style="width:8rem">Categoría</th>
                    <th style="width:8rem">Acción</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-m>
                  <tr class="marca" [class.marca-bajo]="m.accion === 'actualiza'">
                    <td class="cifra tenue">{{ m.fila }}</td>
                    <td><span class="codigo">{{ m.codigo }}</span></td>
                    <td>{{ m.nombre }}</td>
                    <td><span class="codigo">{{ m.categoria }}</span></td>
                    <td>
                      <span class="accion" [class.actualiza]="m.accion === 'actualiza'">
                        {{ m.accion === 'actualiza' ? 'Actualiza' : 'Nuevo' }}
                      </span>
                    </td>
                  </tr>
                </ng-template>
              </p-table>
            }

            <div class="confirmar">
              <button pButton icon="pi pi-check" label="Confirmar importación"
                      [loading]="importando()" (click)="importar()"></button>
              <button pButton label="Elegir otro archivo" severity="secondary" text
                      (click)="limpiar()"></button>
            </div>
          }
        </div>
      </section>
    }
  `,
  styles: [`
    .paso { display:flex; gap:1.25rem; padding:1.5rem 0;
            border-bottom:1px solid var(--linea-tenue); }
    .paso:last-child { border-bottom:0; }

    .numero { flex:none; width:2rem; height:2rem; border-radius:50%;
              display:flex; align-items:center; justify-content:center;
              background:var(--acento-lavado); color:var(--acento);
              font-weight:600; font-size:var(--t-sm); }
    .numero.con-error { background:var(--alerta-lavado); color:var(--alerta); }

    .contenido { flex:1; min-width:0; }
    .contenido h2 { font-size:var(--t-base); font-weight:600; margin:0 0 .25rem; }
    .contenido > p { font-size:var(--t-sm); color:var(--tinta-suave);
                     margin:0 0 .875rem; line-height:1.5; max-width:70ch; }

    .advertencia { padding:.75rem .875rem; border:1px solid var(--linea);
                   border-left:3px solid var(--aviso); border-radius:var(--radio);
                   background:var(--aviso-lavado); color:var(--tinta) !important; }

    .zona-archivo { position:relative; display:flex; align-items:center; gap:.875rem;
                    padding:1rem; border:1px dashed var(--linea);
                    border-radius:var(--radio); background:var(--papel);
                    max-width:32rem; margin-bottom:.875rem; }
    .zona-archivo.con-archivo { border-style:solid; border-color:var(--bien);
                                background:var(--fondo); }
    .zona-archivo > i { font-size:1.5rem; color:var(--tinta-tenue); }
    .zona-archivo.con-archivo > i { color:var(--bien); }
    .zona-archivo .datos { flex:1; display:flex; flex-direction:column; gap:.125rem;
                           min-width:0; }
    .zona-archivo .nombre { font-size:var(--t-sm); font-weight:500;
                            overflow:hidden; text-overflow:ellipsis;
                            white-space:nowrap; }
    .zona-archivo .peso { font-size:var(--t-xs); color:var(--tinta-suave); }
    .zona-archivo input[type="file"] { position:absolute; inset:0; opacity:0;
                                       cursor:pointer; }

    .error-archivo { display:block; margin:-.5rem 0 .875rem;
                     font-size:var(--t-xs); color:var(--alerta); }

    .rotulo-muestra { font-size:var(--t-xs); color:var(--tinta-suave);
                      margin:1rem 0 .5rem; }

    .accion { font-size:var(--t-xs); padding:.0625rem .4375rem; border-radius:2px;
              border:1px solid var(--bien); color:var(--bien); }
    .accion.actualiza { border-color:var(--aviso); color:var(--aviso); }

    .confirmar { display:flex; gap:.5rem; align-items:center; margin-top:1.25rem; }
    .tenue { color:var(--tinta-suave); }
  `],
})
export class ProductoImportarComponent {
  private readonly servicio = inject(ImportacionService);
  private readonly router = inject(Router);
  private readonly mensajes = inject(MessageService);

  readonly archivo = signal<File | null>(null);
  readonly revision = signal<RevisionImportacion | null>(null);
  readonly errorArchivo = signal<string | null>(null);

  readonly bajando = signal(false);
  readonly revisando = signal(false);
  readonly importando = signal(false);

  descargar(): void {
    this.bajando.set(true);

    this.servicio.descargarPlantilla().subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `plantilla-productos-${new Date().toISOString().slice(0, 10)}.xlsx`;
        enlace.click();
        URL.revokeObjectURL(url);
        this.bajando.set(false);
      },
      error: () => {
        this.bajando.set(false);
        this.mensajes.add({
          severity: 'error',
          summary: 'No se pudo descargar',
          detail: 'Intente nuevamente en unos segundos.',
        });
      },
    });
  }

  elegir(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0] ?? null;
    entrada.value = '';

    this.errorArchivo.set(null);
    this.revision.set(null);

    if (!archivo) return;

    // Se verifica acá también: subir 5 MB para que el servidor lo rechace al
    // final es tiempo perdido.
    if (!/\.(xlsx|xls)$/i.test(archivo.name)) {
      this.errorArchivo.set(
        'El archivo debe ser .xlsx o .xls. Si lo guardó como CSV, vuelva a guardarlo como Excel.');
      return;
    }

    if (archivo.size > 5 * 1024 * 1024) {
      this.errorArchivo.set('El archivo supera los 5 MB.');
      return;
    }

    this.archivo.set(archivo);
  }

  revisar(): void {
    const archivo = this.archivo();
    if (!archivo) return;

    this.revisando.set(true);
    this.errorArchivo.set(null);

    this.servicio.revisar(archivo).subscribe({
      next: r => {
        this.revision.set(r);
        this.revisando.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.revisando.set(false);
        this.errorArchivo.set(
          error.error?.message
          ?? error.error?.errors?.archivo?.[0]
          ?? 'No se pudo leer el archivo.');
      },
    });
  }

  importar(): void {
    const archivo = this.archivo();
    if (!archivo) return;

    this.importando.set(true);

    this.servicio.importar(archivo).subscribe({
      next: resultado => {
        this.importando.set(false);
        this.mensajes.add({
          severity: 'success',
          summary: 'Importación completada',
          detail: resultado.mensaje,
          life: 8000,
        });
        this.router.navigate(['/productos']);
      },
      error: (error: HttpErrorResponse) => {
        this.importando.set(false);

        // El archivo pudo cambiar de estado entre revisar e importar: se
        // vuelve a mostrar el detalle en vez de un mensaje genérico.
        if (error.status === 422 && error.error?.errores) {
          this.revision.set(error.error);
          return;
        }

        this.mensajes.add({
          severity: 'error',
          summary: 'No se pudo importar',
          detail: error.error?.mensaje ?? 'No se guardó ningún producto.',
          life: 10000,
        });
      },
    });
  }

  limpiar(): void {
    this.archivo.set(null);
    this.revision.set(null);
    this.errorArchivo.set(null);
  }
}
