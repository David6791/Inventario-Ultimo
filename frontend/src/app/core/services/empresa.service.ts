import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Empresa {
  nombre: string;
  subtitulo: string | null;
  tiene_logo: boolean;
  tiene_marca: boolean;
  marca_agua_opacidad: number;
  /** Cambia cada vez que se guardan los datos: rompe la caché de las imágenes. */
  version: number;
}

/**
 * Nombre y logo de la empresa (Administración → Datos de la empresa). Se
 * piden una vez al abrir la aplicación; la pantalla de ingreso y el marco
 * los muestran, y también salen en todos los PDF.
 */
@Injectable({ providedIn: 'root' })
export class EmpresaService {
  private readonly http = inject(HttpClient);
  private readonly titulo = inject(Title);
  private readonly base = `${environment.apiUrl}/empresa`;

  readonly datos = signal<Empresa | null>(null);
  readonly nombre = computed(() => this.datos()?.nombre ?? '');
  readonly logoUrl = computed(() => {
    const d = this.datos();
    return d?.tiene_logo ? `${this.base}/logo?v=${d.version}` : null;
  });

  cargar(): void {
    if (this.datos()) return;
    this.refrescar().subscribe({ error: () => undefined });
  }

  refrescar(): Observable<Empresa> {
    return this.http.get<{ data: Empresa }>(this.base).pipe(
      map((r) => r.data),
      tap((d) => { this.datos.set(d); this.titulo.setTitle(d.nombre); }),
    );
  }

  /** Imagen de la marca de agua (exige sesión): como blob para la vista previa. */
  marcaAgua(): Observable<Blob> {
    return this.http.get(`${this.base}/marca-agua`, { params: { v: String(this.datos()?.version ?? 0) }, responseType: 'blob' });
  }

  guardar(datos: FormData): Observable<{ data: Empresa; mensaje: string }> {
    return this.http.post<{ data: Empresa; mensaje: string }>(this.base, datos).pipe(
      tap((r) => { this.datos.set(r.data); this.titulo.setTitle(r.data.nombre); }),
    );
  }
}
