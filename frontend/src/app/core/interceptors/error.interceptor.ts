import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Los errores hablan en el idioma del usuario y dicen qué hacer.
 * Los 422 no se muestran acá: los pinta el formulario campo por campo.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const mensajes = inject(MessageService);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      switch (error.status) {
        case 401:
          if (!req.url.endsWith('/login')) {
            mensajes.add({
              severity: 'warn',
              summary: 'Su sesión terminó',
              detail: 'Vuelva a ingresar para continuar.',
            });
            auth.salir();
          }
          break;

        case 403:
          mensajes.add({
            severity: 'error',
            summary: 'Sin permiso',
            detail: error.error?.message ?? 'No tiene permiso para realizar esta acción.',
          });
          // El servidor mandará una versión nueva y el otro interceptor
          // recargará el perfil, así los botones se ajustan solos.
          break;

        case 409:
          mensajes.add({
            severity: 'warn',
            summary: 'No se pudo completar',
            detail: error.error?.message ?? 'La operación entra en conflicto con el estado actual.',
          });
          break;

        case 422:
          break;

        case 429:
          mensajes.add({
            severity: 'warn',
            summary: 'Demasiados intentos',
            detail: 'Espere un minuto antes de volver a intentar.',
          });
          break;

        case 0:
          mensajes.add({
            severity: 'error',
            summary: 'Sin conexión con el servidor',
            detail: 'Revise su red e intente de nuevo.',
          });
          break;

        case 500:
        case 503:
          mensajes.add({
            severity: 'error',
            summary: 'Error del servidor',
            detail: 'El sistema no pudo procesar la solicitud. Avise al administrador.',
          });
          break;
      }

      return throwError(() => error);
    }),
  );
};
