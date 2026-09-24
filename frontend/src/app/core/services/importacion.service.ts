import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ResultadoImportacion, RevisionImportacion } from '../models/importacion.models';

@Injectable({ providedIn: 'root' })
export class ImportacionService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** La plantilla trae las categorías y unidades actuales del sistema. */
  descargarPlantilla(): Observable<Blob> {
    return this.http.get(`${this.api}/productos-plantilla`, { responseType: 'blob' });
  }

  /** Revisa sin escribir nada: devuelve qué pasaría. */
  revisar(archivo: File): Observable<RevisionImportacion> {
    return this.http.post<RevisionImportacion>(
      `${this.api}/productos-importar/revisar`, this.cuerpo(archivo),
    );
  }

  importar(archivo: File): Observable<ResultadoImportacion> {
    return this.http.post<ResultadoImportacion>(
      `${this.api}/productos-importar`, this.cuerpo(archivo),
    );
  }

  private cuerpo(archivo: File): FormData {
    const cuerpo = new FormData();
    cuerpo.append('archivo', archivo);
    return cuerpo;
  }
}
