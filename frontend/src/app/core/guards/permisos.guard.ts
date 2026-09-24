import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { PermisosService } from '../services/permisos.service';

/** Solo verifica sesión. Se combina con los guards de permiso. */
export const autenticadoGuard: CanActivateFn = () => {
  const permisos = inject(PermisosService);
  const router = inject(Router);

  return permisos.autenticado() ? true : router.createUrlTree(['/ingresar']);
};

/**
 * Guard de permiso sobre rutas perezosas.
 *
 * Se usa canMatch en vez de canActivate a propósito: además de bloquear el
 * acceso, evita que el navegador descargue el chunk de un módulo al que el
 * usuario no entra nunca. Devuelve un UrlTree en lugar de `false` + navigate,
 * que es la forma correcta de redirigir según la documentación de Angular.
 */
export const conPermiso = (permiso: string): CanMatchFn => () => {
  const permisos = inject(PermisosService);
  const router = inject(Router);

  if (!permisos.autenticado()) return router.createUrlTree(['/ingresar']);

  return permisos.can(permiso) ? true : router.createUrlTree(['/sin-permiso']);
};

/** Deja pasar si tiene al menos uno. Útil en secciones con varias pantallas. */
export const conAlgunPermiso = (lista: string[]): CanMatchFn => () => {
  const permisos = inject(PermisosService);
  const router = inject(Router);

  if (!permisos.autenticado()) return router.createUrlTree(['/ingresar']);

  return permisos.canAlguno(lista) ? true : router.createUrlTree(['/sin-permiso']);
};

/** Bloquea el resto del sistema mientras el usuario no cambie su clave temporal. */
export const claveVigenteGuard: CanActivateFn = () => {
  const permisos = inject(PermisosService);
  const router = inject(Router);

  return permisos.perfil()?.debe_cambiar_clave
    ? router.createUrlTree(['/cambiar-clave'])
    : true;
};
