import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Foto, TipoFoto } from '../models/foto.model';

@Injectable({ providedIn: 'root' })
export class FotoService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/activos`;

  listar(activoId: number): Observable<Foto[]> {
    return this.http
      .get<{ data: Foto[] }>(`${this.base}/activos/${activoId}/fotos`)
      .pipe(map((r) => r.data));
  }

  subir(
    activoId: number, archivo: Blob, tipo: TipoFoto,
    descripcion?: string, principal = false
  ): Observable<Foto> {
    const datos = new FormData();
    datos.append('archivo', archivo, 'foto.jpg');
    datos.append('tipo', tipo);
    if (descripcion) datos.append('descripcion', descripcion);
    if (principal) datos.append('principal', '1');

    return this.http
      .post<{ data: Foto }>(`${this.base}/activos/${activoId}/fotos`, datos)
      .pipe(map((r) => r.data));
  }

  marcarPrincipal(fotoId: number): Observable<{ data: Foto; mensaje: string }> {
    return this.http.post<{ data: Foto; mensaje: string }>(
      `${this.base}/fotos/${fotoId}/principal`, {}
    );
  }

  eliminar(fotoId: number): Observable<{ mensaje: string }> {
    return this.http.delete<{ mensaje: string }>(`${this.base}/fotos/${fotoId}`);
  }

  /**
   * Reduce la foto antes de subirla.
   *
   * Una foto de teléfono pesa 4 MB; para identificar un equipo alcanzan 200 KB.
   * El servidor también la comprime, pero hacerlo acá evita subir 4 MB sobre
   * la conexión de un acopio remoto, que es donde la diferencia se nota.
   */
  comprimir(archivo: File, ladoLargo = 1600, calidad = 0.8): Promise<Blob> {
    return new Promise((resolver, rechazar) => {
      const lector = new FileReader();

      lector.onload = () => {
        const imagen = new Image();

        imagen.onload = () => {
          const mayor = Math.max(imagen.width, imagen.height);
          const escala = mayor > ladoLargo ? ladoLargo / mayor : 1;

          const lienzo = document.createElement('canvas');
          lienzo.width = Math.round(imagen.width * escala);
          lienzo.height = Math.round(imagen.height * escala);

          const ctx = lienzo.getContext('2d');

          if (!ctx) {
            rechazar(new Error('No se pudo procesar la imagen'));
            return;
          }

          // Fondo blanco: un PNG transparente quedaría negro en JPG.
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, lienzo.width, lienzo.height);
          ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

          lienzo.toBlob(
            (blob) => blob ? resolver(blob) : rechazar(new Error('No se pudo comprimir')),
            'image/jpeg',
            calidad
          );
        };

        imagen.onerror = () => rechazar(new Error('No se pudo leer la imagen'));
        imagen.src = lector.result as string;
      };

      lector.onerror = () => rechazar(new Error('No se pudo leer el archivo'));
      lector.readAsDataURL(archivo);
    });
  }
}
