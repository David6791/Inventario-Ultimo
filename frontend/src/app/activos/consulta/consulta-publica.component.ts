import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';

interface FichaPublica {
  codigo: string;
  denominacion: string;
  identificacion: {
    marca: string | null; modelo: string | null;
    serie: string | null; placa: string | null; anio: number | null;
  };
  clasificacion: { clase: string | null; subclase: string | null };
  situacion: { estado: string; condicion: string; asignado: boolean };
  ubicacion: { nombre: string | null; ruta: string | null };
  custodio: { nombre: string; cargo: string | null; centro: string | null } | null;
  incorporacion: string | null;
  es_bien_control: boolean;
  fotos: { url: string; miniatura: string; tipo: string; fecha: string }[];
}

/**
 * Lo que se ve al escanear la etiqueta de un bien.
 *
 * Pensada para un teléfono en la mano, con el bien delante y posiblemente
 * con poca señal: sin login, sin menú, sin nada que cargar de más.
 */
@Component({
  selector: 'app-consulta-publica',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pantalla">

      <div class="cargando" *ngIf="cargando()">
        <div class="spinner"></div>
        <p>Buscando el bien…</p>
      </div>

      <div class="no-encontrado" *ngIf="error()">
        <div class="icono-error">?</div>
        <h1>Bien no encontrado</h1>
        <p class="codigo-buscado">{{ codigo }}</p>
        <p class="explicacion">
          Este código no corresponde a ningún bien registrado. Puede ser una
          etiqueta antigua o de otro sistema.
        </p>
      </div>

      <ng-container *ngIf="ficha() as f">

        <header class="cabecera">
          <div class="codigo">{{ f.codigo }}</div>
          <h1>{{ f.denominacion }}</h1>
          <div class="clasificacion">
            {{ f.clasificacion.clase }}
            <span *ngIf="f.clasificacion.subclase"> · {{ f.clasificacion.subclase }}</span>
          </div>
        </header>
        <div class="fotos" *ngIf="f.fotos.length">
          <img *ngFor="let foto of f.fotos" [src]="foto.miniatura"
               [alt]="foto.tipo" (click)="verFoto(foto.url)" loading="lazy" />
        </div>
        <!-- Lo primero que uno quiere saber con el bien delante -->
        <div class="estado-principal" [ngClass]="claseEstado(f.situacion.estado)">
          <div class="estado-etiqueta">{{ etiquetaEstado(f.situacion.estado) }}</div>
          <div class="estado-detalle" *ngIf="f.custodio; else sinCustodio">
            A cargo de <strong>{{ f.custodio.nombre }}</strong>
            <span *ngIf="f.custodio.cargo"><br />{{ f.custodio.cargo }}</span>
          </div>
          <ng-template #sinCustodio>
            <div class="estado-detalle">Sin custodio asignado</div>
          </ng-template>
        </div>

        <section class="bloque" *ngIf="f.ubicacion.ruta">
          <h2>Ubicación registrada</h2>
          <p class="ubicacion">{{ f.ubicacion.ruta }}</p>
          <p class="aviso-ubicacion">
            Si el bien no está aquí, repórtelo al encargado de activos.
          </p>
        </section>

        <section class="bloque">
          <h2>Identificación</h2>
          <dl>
            <ng-container *ngIf="f.identificacion.marca">
              <dt>Marca</dt><dd>{{ f.identificacion.marca }}</dd>
            </ng-container>
            <ng-container *ngIf="f.identificacion.modelo">
              <dt>Modelo</dt><dd>{{ f.identificacion.modelo }}</dd>
            </ng-container>
            <ng-container *ngIf="f.identificacion.serie">
              <dt>Serie</dt><dd class="mono">{{ f.identificacion.serie }}</dd>
            </ng-container>
            <ng-container *ngIf="f.identificacion.placa">
              <dt>Placa</dt><dd class="mono">{{ f.identificacion.placa }}</dd>
            </ng-container>
            <ng-container *ngIf="f.identificacion.anio">
              <dt>Año</dt><dd>{{ f.identificacion.anio }}</dd>
            </ng-container>
            <dt>Condición</dt><dd>{{ f.situacion.condicion }}</dd>
            <ng-container *ngIf="f.incorporacion">
              <dt>Incorporado</dt><dd>{{ f.incorporacion | date: 'dd/MM/yyyy' }}</dd>
            </ng-container>
          </dl>
        </section>

        <div class="marca-control" *ngIf="f.es_bien_control">
          Bien de control — no integra el activo fijo
        </div>

        <footer class="pie">
          <p>Para ver el detalle completo, ingrese al sistema.</p>
        </footer>
      </ng-container>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: #f4f5f7;
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      color: #1f2937;
    }

    .pantalla {
      max-width: 34rem;
      margin: 0 auto;
      padding: 1.25rem 1rem 3rem;
    }

    /* ─────────────────────────────────────────────────────── Cabecera */

    .cabecera {
      padding: 1.5rem 1.25rem;
      margin-bottom: 0.75rem;
      background: #fff;
      border-radius: 14px;
    }

    .codigo {
      font-family: ui-monospace, 'SF Mono', Menlo, monospace;
      font-size: 0.95rem;
      font-weight: 650;
      letter-spacing: -0.02em;
      color: #1f4e79;
      margin-bottom: 0.4rem;
    }

    .cabecera h1 {
      margin: 0;
      font-size: 1.4rem;
      font-weight: 650;
      line-height: 1.25;
      letter-spacing: -0.02em;
    }

    .clasificacion {
      margin-top: 0.4rem;
      font-size: 0.85rem;
      color: #6b7280;
    }

    /* ────────────────────────────────── Estado: lo más importante */

    .estado-principal {
      padding: 1.25rem;
      margin-bottom: 0.75rem;
      border-radius: 14px;
      border-left: 5px solid;
    }

    .estado-etiqueta {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.4rem;
    }

    .estado-detalle { font-size: 1rem; line-height: 1.45; }

    .en-uso {
      background: #f0fdf4; border-color: #16a34a; color: #14532d;
    }
    .disponible {
      background: #eff6ff; border-color: #3b82f6; color: #1e3a8a;
    }
    .atencion {
      background: #fffbeb; border-color: #f59e0b; color: #78350f;
    }
    .baja {
      background: #fef2f2; border-color: #dc2626; color: #7f1d1d;
    }

    /* ──────────────────────────────────────────────────────── Bloques */

    .bloque {
      padding: 1.25rem;
      margin-bottom: 0.75rem;
      background: #fff;
      border-radius: 14px;
    }
    .fotos {
      display: flex; gap: 0.5rem; overflow-x: auto;
      padding: 0 0 0.75rem; margin-bottom: 0.75rem;
      -webkit-overflow-scrolling: touch;
    }
 
    .fotos img {
      flex: 0 0 auto;
      width: 7rem; height: 7rem;
      object-fit: cover;
      border-radius: 10px;
      cursor: zoom-in;
    }
    .bloque h2 {
      margin: 0 0 0.75rem;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #9ca3af;
    }

    .ubicacion {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 550;
      line-height: 1.4;
    }

    .aviso-ubicacion {
      margin: 0.6rem 0 0;
      font-size: 0.8rem;
      color: #6b7280;
    }

    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.5rem 1rem;
      margin: 0;
      font-size: 0.92rem;
    }

    dt { color: #6b7280; }
    dd { margin: 0; font-weight: 500; }

    .mono {
      font-family: ui-monospace, 'SF Mono', Menlo, monospace;
      font-size: 0.85rem;
    }

    .marca-control {
      padding: 0.75rem 1.25rem;
      margin-bottom: 0.75rem;
      font-size: 0.82rem;
      color: #78350f;
      background: #fef3c7;
      border-radius: 10px;
      text-align: center;
    }

    /* ──────────────────────────────────────────────── Otros estados */

    .cargando, .no-encontrado {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      padding: 5rem 1rem;
      text-align: center;
    }

    .spinner {
      width: 2.5rem; height: 2.5rem;
      border: 3px solid #e5e7eb;
      border-top-color: #1f4e79;
      border-radius: 50%;
      animation: girar 0.8s linear infinite;
    }

    @keyframes girar { to { transform: rotate(360deg); } }

    .icono-error {
      display: grid; place-items: center;
      width: 4rem; height: 4rem;
      font-size: 2rem; font-weight: 700;
      color: #9ca3af;
      background: #e5e7eb;
      border-radius: 50%;
    }

    .no-encontrado h1 { margin: 0; font-size: 1.3rem; }

    .codigo-buscado {
      font-family: ui-monospace, monospace;
      font-size: 0.9rem;
      color: #6b7280;
      margin: 0;
    }

    .explicacion {
      max-width: 24rem;
      font-size: 0.9rem;
      line-height: 1.5;
      color: #6b7280;
      margin: 0;
    }

    .pie {
      margin-top: 1.5rem;
      text-align: center;
      font-size: 0.8rem;
      color: #9ca3af;
    }

    .pie p { margin: 0; }
  `],
})
export class ConsultaPublicaComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly ruta = inject(ActivatedRoute);

  readonly ficha = signal<FichaPublica | null>(null);
  readonly cargando = signal(true);
  readonly error = signal(false);

  codigo = '';

  ngOnInit(): void {
    this.codigo = this.ruta.snapshot.paramMap.get('codigo') ?? '';

    this.http
      .get<{ data: FichaPublica }>(`${environment.apiUrl}/activos/consulta/${this.codigo}`)
      .subscribe({
        next: (r) => { this.ficha.set(r.data); this.cargando.set(false); },
        error: () => { this.error.set(true); this.cargando.set(false); },
      });
  }

  etiquetaEstado(estado: string): string {
    return {
      REGISTRADO: 'Disponible',
      EN_USO: 'En uso',
      EN_REPARACION: 'En reparación',
      OCIOSO: 'Sin uso',
      EN_TRANSITO: 'En tránsito',
      FUERA_DE_INSTALACION: 'Fuera de instalaciones',
      DADO_DE_BAJA: 'Dado de baja',
    }[estado] ?? estado;
  }

  claseEstado(estado: string): string {
    return {
      REGISTRADO: 'disponible',
      EN_USO: 'en-uso',
      EN_REPARACION: 'atencion',
      OCIOSO: 'atencion',
      EN_TRANSITO: 'atencion',
      FUERA_DE_INSTALACION: 'atencion',
      DADO_DE_BAJA: 'baja',
    }[estado] ?? 'disponible';
  }
  verFoto(url: string): void {
    window.open(url, '_blank');
  }
}
