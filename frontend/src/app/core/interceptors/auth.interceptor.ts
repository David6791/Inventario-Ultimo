import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { PermisosService } from '../services/permisos.service';

/**
 * Adjunta el token y el almacén activo, y detecta cuándo los permisos del
 * usuario cambiaron del lado del servidor.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const permisos = inject(PermisosService);

  const cabeceras: Record<string, string> = { Accept: 'application/json' };

  const token = auth.token;
  if (token) cabeceras['Authorization'] = `Bearer ${token}`;

  const almacen = permisos.almacenActivo();
  if (almacen) cabeceras['X-Almacen-Id'] = String(almacen.id);

  return next(req.clone({ setHeaders: cabeceras })).pipe(
    tap(evento => {
      if (!('headers' in evento)) return;

      const version = evento.headers?.get('X-Permisos-Version');
      if (version) verificarVersion(version, auth, req.url);
    }),
  );
};

let versionConocida: string | null = null;
let recargando = false;

/**
 * Si el administrador cambió los permisos de un rol, las sesiones ya abiertas
 * siguen con el arreglo viejo en memoria. Comparar esta versión evita mostrar
 * botones que ya no corresponden, sin websockets ni polling.
 */
function verificarVersion(version: string, auth: AuthService, url: string): void {
  if (versionConocida === null) {
    versionConocida = version;
    return;
  }

  if (versionConocida === version || recargando || url.endsWith('/me')) return;

  versionConocida = version;
  recargando = true;
  auth.cargarPerfil().subscribe({ complete: () => (recargando = false) });
}
