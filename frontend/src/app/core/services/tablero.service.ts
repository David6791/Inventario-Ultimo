import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Tablero } from '../models/tablero.models';

@Injectable({ providedIn: 'root' })
export class TableroService {
  private readonly http = inject(HttpClient);

  cargar(): Observable<Tablero> {
    return this.http.get<Tablero>(`${environment.apiUrl}/tablero`);
  }
}
