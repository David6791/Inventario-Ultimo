import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Perfil, RespuestaLogin } from '../models/auth.models';
import { PermisosService } from './permisos.service';

const CLAVE_TOKEN = 'inv.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly permisos = inject(PermisosService);
  private readonly api = environment.apiUrl;

  get token(): string | null {
    return localStorage.getItem(CLAVE_TOKEN);
  }

  login(email: string, password: string): Observable<RespuestaLogin> {
    return this.http
      .post<RespuestaLogin>(`${this.api}/login`, { email, password, dispositivo: 'web' })
      .pipe(tap(res => {
        localStorage.setItem(CLAVE_TOKEN, res.token);
        this.permisos.establecerPerfil(res.usuario);
      }));
  }

  /**
   * Recarga el perfil. Se usa en tres momentos: al arrancar la app con un token
   * guardado, cuando el header X-Permisos-Version cambia, y después de que el
   * usuario edita sus propios datos.
   */
  cargarPerfil(): Observable<Perfil | null> {
    if (!this.token) return of(null);

    return this.http.get<Perfil>(`${this.api}/me`).pipe(
      tap(perfil => this.permisos.establecerPerfil(perfil)),
      catchError(() => {
        this.limpiarSesion();
        return of(null);
      }),
    );
  }

  logout(): void {
    this.http.post(`${this.api}/logout`, {}).subscribe({
      next: () => this.salir(),
      error: () => this.salir(),
    });
  }

  cambiarClave(passwordActual: string, password: string, passwordConfirmation: string) {
    return this.http.post(`${this.api}/cambiar-clave`, {
      password_actual: passwordActual,
      password,
      password_confirmation: passwordConfirmation,
    });
  }

  /** Sesión inválida detectada por el interceptor: limpia y manda al login. */
  salir(): void {
    this.limpiarSesion();
    this.router.navigate(['/ingresar']);
  }

  private limpiarSesion(): void {
    localStorage.removeItem(CLAVE_TOKEN);
    this.permisos.limpiar();
  }
}
