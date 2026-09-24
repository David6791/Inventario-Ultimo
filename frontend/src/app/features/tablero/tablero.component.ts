import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { Alerta, Pendiente, Tablero } from '../../core/models/tablero.models';
import { PermisosService } from '../../core/services/permisos.service';
import { TableroService } from '../../core/services/tablero.service';

/**
 * El tablero.
 *
 * No es un panel de métricas: es la lista de pendientes del día. Las tarjetas
 * aparecen solo cuando hay algo que hacer, así que un tablero vacío significa
 * que no quedó nada a medias — eso es información, no una pantalla rota.
 */
@Component({
  selector: 'app-tablero',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, TableModule, ButtonModule, TooltipModule],
  template: `
    <header class="pagina">
      <div>
        <h1>Hola, {{ permisos.usuario()?.name }}</h1>
        <p>Está trabajando en {{ permisos.almacenActivo()?.nombre }}.</p>
      </div>
    </header>

    @if (cargando()) {
      <div class="cargando">
        <i class="pi pi-spin pi-spinner"></i>
        <span>Revisando el almacén…</span>
      </div>
    } @else {
      @if (datos(); as t) {

      <!-- Cifras: contexto, no urgencia. Van primero pero discretas. -->
      @if (t.cifras.length) {
        <div class="cifras">
          @for (c of t.cifras; track c.clave) {
            <div class="cifra">
              <span class="numero">
                {{ c.tipo === 'moneda' ? 'Bs ' : '' }}{{ c.valor | number: (c.tipo === 'moneda' ? '1.2-2' : '1.0-0') }}
              </span>
              <span class="rotulo">{{ c.rotulo }}</span>
            </div>
          }
        </div>
      }

      <!-- Pendientes: lo que hay que hacer. -->
      @if (t.pendientes.length) {
        <section>
          <h2>Requiere su atención</h2>
          <div class="tarjetas">
            @for (p of t.pendientes; track p.clave) {
              <article class="tarjeta" [class]="'urgencia-' + p.urgencia">
                <div class="encabezado">
                  <i [class]="p.icono"></i>
                  <span class="cantidad">{{ p.cantidad }}</span>
                </div>
                <h3>{{ p.titulo }}</h3>
                <p>{{ p.descripcion }}</p>
                @if (p.ruta) {
                  <a class="accion" [routerLink]="p.ruta">
                    {{ p.accion }} <i class="pi pi-arrow-right"></i>
                  </a>
                }
              </article>
            }
          </div>
        </section>
      }

      <!-- Alertas de inventario. -->
      @if (t.alertas.length) {
        <section>
          <h2>Inventario</h2>
          <div class="tarjetas">
            @for (a of t.alertas; track a.clave) {
              <article class="tarjeta" [class]="'urgencia-' + a.urgencia">
                <div class="encabezado">
                  <i [class]="a.icono"></i>
                  <span class="cantidad">{{ a.cantidad }}</span>
                </div>
                <h3>{{ a.titulo }}</h3>
                <p>{{ a.descripcion }}</p>
                <a class="accion" [routerLink]="rutaBase(a)" [queryParams]="parametros(a)">
                  Revisar <i class="pi pi-arrow-right"></i>
                </a>
              </article>
            }
          </div>
        </section>
      }

      <!-- Todo al día. -->
      @if (!t.pendientes.length && !t.alertas.length) {
        <div class="al-dia">
          <i class="pi pi-check-circle"></i>
          <div>
            <strong>No hay nada pendiente.</strong>
            <span>Los documentos están confirmados con su respaldo, y el stock
                  no tiene faltantes ni vencimientos próximos.</span>
          </div>
        </div>
      }

      <!-- Movimiento reciente. -->
      @if (t.reciente.length) {
        <section>
          <h2>Últimos movimientos</h2>

          <p-table [value]="t.reciente" dataKey="id" styleClass="p-datatable-sm">
            <ng-template pTemplate="header">
              <tr>
                <th style="width:9rem">Fecha</th>
                <th style="width:13rem">Documento</th>
                <th>Producto</th>
                <th style="width:7rem" class="cifra">Entrada</th>
                <th style="width:7rem" class="cifra">Salida</th>
                <th style="width:12rem">Registró</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-m>
              <tr class="marca" [class.marca-bajo]="m.es_anulacion"
                  [class.atenuada]="m.es_anulacion">
                <td class="tenue">{{ m.fecha | date:'dd/MM/yy HH:mm' }}</td>
                <td>
                  <span class="codigo">{{ m.documento }}</span>
                  @if (m.es_anulacion) { <span class="etiqueta">anulación</span> }
                </td>
                <td>
                  <span class="codigo tenue">{{ m.codigo }}</span>
                  {{ m.producto }}
                </td>
                <td class="cifra entrada">
                  {{ m.entrada > 0 ? (m.entrada | number:'1.0-4') : '' }}
                </td>
                <td class="cifra salida">
                  {{ m.salida > 0 ? (m.salida | number:'1.0-4') : '' }}
                </td>
                <td class="tenue">{{ m.usuario }}</td>
              </tr>
            </ng-template>
          </p-table>
        </section>
      } @else if (!t.pendientes.length && !t.alertas.length) {
        <div class="vacio">
          <i class="pi pi-inbox"></i>
          <p>Este almacén todavía no registra movimientos. Empiece por una
             solicitud de compra o un ingreso.</p>
        </div>
      }
      }
    }
  `,
  styles: [`
    .cargando { display:flex; align-items:center; gap:.625rem; padding:2rem 0;
                color:var(--tinta-suave); font-size:var(--t-sm); }

    /* Las cifras son contexto: presentes pero sin gritar. */
    .cifras { display:flex; gap:2.5rem; flex-wrap:wrap; padding:0 0 1.25rem;
              margin-bottom:1.75rem; border-bottom:1px solid var(--linea); }
    .cifra { display:flex; flex-direction:column; gap:.125rem; }
    .cifra .numero { font-size:1.375rem; font-weight:600; line-height:1.1;
                     font-variant-numeric:tabular-nums; letter-spacing:-0.02em; }
    .cifra .rotulo { font-size:var(--t-xs); color:var(--tinta-suave); }

    section { margin-bottom:1.75rem; }
    section h2 { font-size:var(--t-sm); font-weight:600; text-transform:uppercase;
                 letter-spacing:.04em; color:var(--tinta-suave);
                 margin:0 0 .875rem; }

    .tarjetas { display:grid; gap:.875rem;
                grid-template-columns:repeat(auto-fill, minmax(17rem, 1fr)); }

    /* La barra izquierda marca la urgencia, igual que en las filas de tabla. */
    .tarjeta { position:relative; padding:1rem 1rem 1rem 1.125rem;
               border:1px solid var(--linea); border-radius:var(--radio);
               background:var(--fondo); }
    .tarjeta::before { content:''; position:absolute; left:0; top:0; bottom:0;
                       width:3px; border-radius:var(--radio) 0 0 var(--radio);
                       background:var(--linea); }
    .tarjeta.urgencia-alta::before { background:var(--alerta); }
    .tarjeta.urgencia-media::before { background:var(--aviso); }
    .tarjeta.urgencia-normal::before { background:var(--acento); }
    .tarjeta.urgencia-baja::before { background:var(--linea); }

    .encabezado { display:flex; align-items:baseline; justify-content:space-between;
                  margin-bottom:.5rem; }
    .encabezado i { color:var(--tinta-tenue); font-size:.9375rem; }
    .encabezado .cantidad { font-size:1.5rem; font-weight:600; line-height:1;
                            font-variant-numeric:tabular-nums;
                            letter-spacing:-0.02em; }
    .urgencia-alta .encabezado .cantidad { color:var(--alerta); }
    .urgencia-media .encabezado .cantidad { color:var(--aviso); }

    .tarjeta h3 { font-size:var(--t-base); font-weight:600; margin:0 0 .25rem; }
    .tarjeta p { font-size:var(--t-sm); color:var(--tinta-suave); margin:0;
                 line-height:1.45; }

    .accion { display:inline-flex; align-items:center; gap:.375rem;
              margin-top:.75rem; font-size:var(--t-sm); color:var(--acento);
              text-decoration:none; font-weight:500; }
    .accion i { font-size:.6875rem; }
    .accion:hover { text-decoration:underline; }

    .al-dia { display:flex; align-items:flex-start; gap:.875rem; padding:1.25rem;
              border:1px solid var(--linea); border-left:3px solid var(--bien);
              border-radius:var(--radio); background:var(--papel);
              margin-bottom:1.75rem; max-width:56rem; }
    .al-dia i { color:var(--bien); font-size:1.25rem; }
    .al-dia div { display:flex; flex-direction:column; gap:.25rem; }
    .al-dia span { font-size:var(--t-sm); color:var(--tinta-suave);
                   line-height:1.5; }

    .entrada { color:var(--bien); }
    .salida { color:var(--alerta); }
    .tenue { color:var(--tinta-suave); }
    .etiqueta { font-size:var(--t-xs); color:var(--aviso); margin-left:.5rem; }
  `],
})
export class TableroComponent implements OnInit {
  private readonly servicio = inject(TableroService);
  readonly permisos = inject(PermisosService);

  readonly datos = signal<Tablero | null>(null);
  readonly cargando = signal(true);

  ngOnInit(): void {
    this.servicio.cargar().subscribe({
      next: t => {
        this.datos.set(t);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  /** Las rutas de alerta traen el filtro en la consulta; hay que separarlo. */
  rutaBase(alerta: Alerta): string {
    return alerta.ruta.split('?')[0];
  }

  /*
   | Se recorre con forEach en vez de entries(): ese iterador exige DOM.Iterable
   | en el `lib` del tsconfig, y no vale tocar la configuración del proyecto por
   | un detalle así.
   */
  parametros(alerta: Alerta): Record<string, string> {
    const consulta = alerta.ruta.split('?')[1];
    if (!consulta) return {};

    const parametros: Record<string, string> = {};
    new URLSearchParams(consulta).forEach((valor, clave) => {
      parametros[clave] = valor;
    });

    return parametros;
  }
}
