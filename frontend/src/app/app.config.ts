import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { AuthService } from './core/services/auth.service';

/**
 * Carga el perfil ANTES de que arranque el router.
 *
 * Sin esto, al recargar la página con F5 los guards corren con el estado vacío,
 * no encuentran permisos y mandan al login a un usuario que sí tiene sesión.
 * Es el bug más común de este patrón.
 */
function cargarSesion(auth: AuthService) {
  return () => firstValueFrom(auth.cargarPerfil()).catch(() => null);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),

    MessageService,
    ConfirmationService,

    {
      provide: APP_INITIALIZER,
      useFactory: cargarSesion,
      deps: [AuthService],
      multi: true,
    },
  ],
};
